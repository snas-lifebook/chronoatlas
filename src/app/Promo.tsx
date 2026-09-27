// 홍보 영상 팝업. 영상은 public/promo/atlas.mp4(scripts/record-promo.py가 만든다). 한 번 뜨면 promo-seen-v1을 남긴다.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, Text, Button } from '@astryxdesign/core';
import { PROMO_KEY } from '../promo';

export function Promo({ root, onClose }: { root: string; onClose: () => void }) {
  useEffect(() => {
    try { localStorage.setItem(PROMO_KEY, new Date().toISOString().slice(0, 10)); } catch { /* 저장이 막혀도 이번만 보인다 */ }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  // body로 포털: 셸 안에 두면 부모의 쌓임 맥락에 갇혀 탐색 목록·인물 패널·도구 막대 아래에 깔린다(2026-09-27 라이브에서 확인)
  return createPortal(
    <div className="promo-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="크로노아틀라스 소개 영상">
      <Card padding={3} elevation="high" className="promo-card" onMouseDown={e => e.stopPropagation()}>
        <video src={`${root}promo/atlas.mp4`} poster={`${root}promo/atlas-poster.jpg`} controls autoPlay muted playsInline preload="metadata" />
        <div className="promo-row">
          <Text size="sm" color="secondary">1분 소개 · 소리는 영상 아래에서 켤 수 있습니다</Text>
          <span className="promo-actions">
            <Button label="소개 페이지" variant="secondary" size="sm" onClick={() => open(`${root}about.html`, '_blank', 'noopener')} />
            <Button label="지도 보기" size="sm" onClick={onClose} />
          </span>
        </div>
      </Card>
    </div>,
    document.body,
  );
}
