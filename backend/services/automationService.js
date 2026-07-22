import puppeteer from 'puppeteer';
import { supabase } from '../config/supabase.js';

/**
 * Executes RPA External Form Filling Automation via Puppeteer
 * Includes 35s timeout limit, waitForSelector, and strict finally { await browser.close() }
 */
export async function executeExternalAutomation(cardId) {
  let browser = null;
  const executionLogs = [];

  const addLog = (msg) => {
    const time = new Date().toISOString();
    console.log(`[RPA Automation Worker] [${cardId}] ${msg}`);
    executionLogs.push({ time, message: msg });
  };

  try {
    addLog('Starting RPA External Form Filling Automation...');

    // 1. Fetch complete Card details with Service automation mapping and Contact
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id,
        tenant_id,
        service_id,
        collected_data,
        attachment_metadata,
        services ( external_url, automation_mapping, title ),
        contacts ( name, phone )
      `)
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      throw new Error(`Card ${cardId} not found in database.`);
    }

    const service = card.services;
    const externalUrl = service?.external_url;
    const automationConfig = service?.automation_mapping; // { mappings: [{ css_selector, source_field }], submit_selector }

    if (!externalUrl) {
      throw new Error(`Service "${service?.title || card.service_id}" does not have an external_url configured.`);
    }

    const mappings = Array.isArray(automationConfig?.mappings)
      ? automationConfig.mappings
      : Array.isArray(automationConfig)
        ? automationConfig
        : [];

    if (mappings.length === 0) {
      throw new Error(`Service "${service?.title}" does not have any "De/Para" CSS field mappings configured.`);
    }

    // 2. Mark Card automation_status = 'running'
    await supabase
      .from('cards')
      .update({
        automation_status: 'running',
        automation_result: { status: 'running', logs: executionLogs, started_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);

    // 3. Prepare data map from card, contact, and collected_data
    const dataMap = {
      'Nome do Cliente': card.contacts?.name || '',
      'Telefone': card.contacts?.phone || '',
      'ID do Card': card.id,
      'Título do Serviço': service?.title || '',
      ...(card.collected_data || {}),
      ...(card.attachment_metadata || {})
    };

    // 4. Launch Puppeteer Browser Instance with 35s timeout limit
    addLog(`Launching Headless Browser...`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(35000);
    page.setDefaultNavigationTimeout(35000);

    addLog(`Navigating to external portal: ${externalUrl}`);
    await page.goto(externalUrl, { waitUntil: 'networkidle2' });

    // 5. Fill fields based on "De/Para" CSS selector mappings with waitForSelector
    for (const map of mappings) {
      const { css_selector, source_field } = map;
      if (!css_selector || !source_field) continue;

      const fieldValue = dataMap[source_field] !== undefined && dataMap[source_field] !== null
        ? String(dataMap[source_field])
        : '';

      addLog(`Waiting for selector "${css_selector}" for field "${source_field}"...`);
      await page.waitForSelector(css_selector, { visible: true, timeout: 30000 });

      addLog(`Typing value into "${css_selector}" (Value: ${fieldValue || '[Vazio]'})`);
      await page.focus(css_selector);
      // Clear existing input text if any
      await page.evaluate((sel) => {
        const input = document.querySelector(sel);
        if (input) input.value = '';
      }, css_selector);

      if (fieldValue) {
        await page.type(css_selector, fieldValue, { delay: 50 });
      }
    }

    // 6. Submit button click if configured
    const submitSelector = automationConfig?.submit_selector;
    if (submitSelector) {
      addLog(`Waiting for submit button "${submitSelector}"...`);
      await page.waitForSelector(submitSelector, { visible: true, timeout: 30000 });
      addLog(`Clicking submit button "${submitSelector}"...`);
      await Promise.all([
        page.click(submitSelector),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
      ]);
    }

    // 7. Capture proof screenshot
    addLog(`Capturing execution proof screenshot...`);
    const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'png' });
    const screenshotFileName = `${card.tenant_id}/rpa_${cardId}_${Date.now()}.png`;

    const { data: uploadData } = await supabase.storage
      .from('card-attachments')
      .upload(screenshotFileName, screenshotBuffer, { contentType: 'image/png', upsert: true });

    const { data: urlData } = supabase.storage
      .from('card-attachments')
      .getPublicUrl(screenshotFileName);

    const screenshotUrl = urlData?.publicUrl || screenshotFileName;
    addLog(`Screenshot saved: ${screenshotUrl}`);

    const resultPayload = {
      status: 'success',
      screenshot_url: screenshotUrl,
      logs: executionLogs,
      completed_at: new Date().toISOString()
    };

    // 8. Update Card status = 'success'
    await supabase
      .from('cards')
      .update({
        automation_status: 'success',
        automation_result: resultPayload,
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);

    return { success: true, ...resultPayload };

  } catch (err) {
    const errorMsg = err.message || 'Unknown RPA Automation error';
    addLog(`[ERROR] RPA Automation failed: ${errorMsg}`);

    const resultPayload = {
      status: 'failed',
      error: errorMsg,
      logs: executionLogs,
      failed_at: new Date().toISOString()
    };

    await supabase
      .from('cards')
      .update({
        automation_status: 'failed',
        automation_result: resultPayload,
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId)
      .catch(() => {});

    return { success: false, ...resultPayload };

  } finally {
    // Memory leak prevention: ALWAYS close browser instance inside finally block
    if (browser) {
      console.log(`[RPA Automation Worker] Closing browser instance for card ${cardId}...`);
      await browser.close().catch(e => console.error('Error closing browser:', e));
    }
  }
}
