import { detectPageSnapshot } from './detection';
import type { DetectionMessage } from './types';

let lastUrl = window.location.href;

async function sendSnapshot() {
  const payload = detectPageSnapshot(document);
  await chrome.runtime.sendMessage({
    type: 'PAGE_SNAPSHOT_UPDATED',
    payload,
  } satisfies DetectionMessage);
}

function watchRouteChanges() {
  window.setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      void sendSnapshot();
    }
  }, 1000);
}

chrome.runtime.onMessage.addListener((message: DetectionMessage) => {
  if (message.type === 'REQUEST_PAGE_SNAPSHOT') {
    void sendSnapshot();
  }
});

void sendSnapshot();
watchRouteChanges();
