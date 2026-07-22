import { supabase } from '../config/supabase.js';
import { triggerCardNotification } from '../services/notificationEngine.js';

/**
 * Initializes a realtime listener on cards table using Supabase postgres_changes
 */
export function initCardStatusWatcher() {
  console.log('📡 Starting Card Status Realtime Watcher...');

  const subscription = supabase
    .channel('realtime_cards_watcher')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cards' },
      async (payload) => {
        const oldStatus = payload.old?.status;
        const newStatus = payload.new?.status;
        const cardId = payload.new?.id;

        if (oldStatus !== newStatus && newStatus) {
          console.log(`[Realtime Watcher] Card ${cardId} status changed: ${oldStatus} -> ${newStatus}`);
          const triggerEvent = `status_${newStatus}`;
          await triggerCardNotification(cardId, triggerEvent);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cards' },
      async (payload) => {
        const cardId = payload.new?.id;
        console.log(`[Realtime Watcher] New Card created: ${cardId}`);
        await triggerCardNotification(cardId, 'card_created');
      }
    )
    .subscribe((status) => {
      console.log(`📡 Card Status Realtime Watcher subscription status: ${status}`);
    });

  return subscription;
}
