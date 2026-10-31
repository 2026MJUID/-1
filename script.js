/**
 * 불완전연소 (INCOMPLETE COMBUSTION) — MOBILE INVITATION
 *
 * 1. 첫 화면: 흰색(#FFFFFF) 배경 + 숨겨진 숯 터치 인터랙션 + 하단 중앙 '불완전연소'
 * 2. 3.5~4초 인터랙션 경험 후 자동으로 다크 스테이지로 전환
 * 3. 다크 스테이지: 화면 전체가 물리적으로 스크롤되어 내려가는 대신,
 *    고정된 검정 화면 위에서 스크롤/스와이프할 때마다 글씨들만 제자리에서 뿅뿅 올라오는 연출
 */
'use strict';

(() => {
  /* ===================================================================
     1. DOM REFERENCES
     =================================================================== */
  const appFrame = document.getElementById('appFrame');
  const coverStage = document.getElementById('coverStage');
  const coverBgImg = document.getElementById('coverBgImg');
  const charcoalCanvas = document.getElementById('charcoalCanvas');
  const ctx = charcoalCanvas.getContext('2d');
  const themeColorMeta = document.getElementById('themeColorMeta');

  const closeInfoBtn = document.getElementById('closeInfoBtn');
  const infoModal = document.getElementById('infoModal');
  const scenesStage = document.getElementById('scenesStage');
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const unifiedInfoScroll = document.getElementById('unifiedInfoScroll');
  const pageDots = Array.from(document.querySelectorAll('#modalPageDots .dot'));

  const venueCopyTrigger = document.getElementById('venueCopyTrigger');
  const mapInteractiveBox = document.getElementById('mapInteractiveBox');
  const mapActionBackdrop = document.getElementById('mapActionBackdrop');
  const btnCopyAddress = document.getElementById('btnCopyAddress');
  const btnCloseAction = document.getElementById('btnCloseAction');

  const toastEl = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  /* ===================================================================
     2. FIXED CHARCOAL SYMBOL LAYER SEPARATION (ON WHITE COVER)
     =================================================================== */
  const CHARCOAL_PARAMS = {
    minDiameter: 160,
    maxDiameter: 220,
    diameterRatio: 0.48,   // 화면 너비에 맞춰 지름 160~220px 자동 조절
    fadeInMs: 140,         // 손가락이 닿을 때 부드럽게 나타나는 시간 (ms)
    greyDecayMs: 1350,     // 지나간 자리의 회색 결이 사라지는 시간 (1~1.5초)
    redDecayMs: 2350,      // 빨간 열점이 회색 결보다 늦게 잔열처럼 사라지는 시간
    greyMaxAlpha: 0.56,    // 흰 배경 위 회색 결 최대 투명도 (은은하게)
    redMaxAlpha: 0.98,     // 흰 배경 위 빨간 열점 최대 투명도 (회색보다 선명하게)
    stepDistPx: 12,        // 드래그 경로 연속 보간 간격 (px)
    autoTransitionMs: 3600 // 첫 화면에서 약 3.5~4초 경험 후 자동 전환 (3.6초)
  };

  let viewW = 0;
  let viewH = 0;
  let dpr = 1;
  let brushRadius = 95;

  const rawGreyCanvas = document.createElement('canvas');
  const rawRedCanvas = document.createElement('canvas');
  let isAssetLoaded = false;

  const screenGreyCanvas = document.createElement('canvas');
  const screenRedCanvas = document.createElement('canvas');

  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  const compCanvas = document.createElement('canvas');
  const compCtx = compCanvas.getContext('2d');

  const charcoalImg = new Image();
  charcoalImg.src = 'assets/charcoal-symbol.png';
  charcoalImg.onload = () => {
    const iw = charcoalImg.naturalWidth || 600;
    const ih = charcoalImg.naturalHeight || 600;

    rawGreyCanvas.width = iw;
    rawGreyCanvas.height = ih;
    rawRedCanvas.width = iw;
    rawRedCanvas.height = ih;

    const greyCtx = rawGreyCanvas.getContext('2d');
    const redCtx = rawRedCanvas.getContext('2d');

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = iw;
      tempCanvas.height = ih;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(charcoalImg, 0, 0, iw, ih);

      const srcData = tempCtx.getImageData(0, 0, iw, ih);
      const src = srcData.data;

      const greyImgData = greyCtx.createImageData(iw, ih);
      const redImgData = redCtx.createImageData(iw, ih);
      const gDst = greyImgData.data;
      const rDst = redImgData.data;

      for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        if (a === 0) continue;

        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];

        const redness = r - Math.max(g, b);
        if (redness > 25) {
          rDst[i] = 226;
          rDst[i + 1] = 12;
          rDst[i + 2] = 12;
          rDst[i + 3] = Math.min(255, Math.round(a * 1.45));
        } else {
          gDst[i] = 105;
          gDst[i + 1] = 105;
          gDst[i + 2] = 110;
          gDst[i + 3] = a;
        }
      }

      greyCtx.putImageData(greyImgData, 0, 0);
      redCtx.putImageData(redImgData, 0, 0);
    } catch (_) {
      greyCtx.save();
      greyCtx.filter = 'url(#extractGreyOnWhiteFilter)';
      greyCtx.drawImage(charcoalImg, 0, 0, iw, ih);
      greyCtx.restore();

      redCtx.save();
      redCtx.filter = 'url(#extractRedFilter)';
      redCtx.drawImage(charcoalImg, 0, 0, iw, ih);
      redCtx.restore();
    }

    isAssetLoaded = true;
    rebuildFixedScreenLayers();
  };

  function rebuildFixedScreenLayers() {
    if (!isAssetLoaded || viewW === 0 || viewH === 0) return;

    const pw = Math.round(viewW * dpr);
    const ph = Math.round(viewH * dpr);

    screenGreyCanvas.width = pw;
    screenGreyCanvas.height = ph;
    screenRedCanvas.width = pw;
    screenRedCanvas.height = ph;

    const sGreyCtx = screenGreyCanvas.getContext('2d');
    const sRedCtx = screenRedCanvas.getContext('2d');

    sGreyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sRedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    sGreyCtx.clearRect(0, 0, viewW, viewH);
    sRedCtx.clearRect(0, 0, viewW, viewH);

    const drawSize = Math.max(viewW * 2.13, viewH * 1.16);
    const drawX = -drawSize * 0.475;
    const drawY = viewH - drawSize * 0.70;

    sGreyCtx.drawImage(rawGreyCanvas, drawX, drawY, drawSize, drawSize);
    sRedCtx.drawImage(rawRedCanvas, drawX, drawY, drawSize, drawSize);
  }

  function resizeStage() {
    const rect = appFrame.getBoundingClientRect();
    viewW = rect.width;
    viewH = rect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);

    const pw = Math.round(viewW * dpr);
    const ph = Math.round(viewH * dpr);

    charcoalCanvas.width = pw;
    charcoalCanvas.height = ph;
    maskCanvas.width = pw;
    maskCanvas.height = ph;
    compCanvas.width = pw;
    compCanvas.height = ph;

    const diameter = Math.max(
      CHARCOAL_PARAMS.minDiameter,
      Math.min(CHARCOAL_PARAMS.maxDiameter, viewW * CHARCOAL_PARAMS.diameterRatio)
    );
    brushRadius = diameter / 2;

    rebuildFixedScreenLayers();
  }

  window.addEventListener('resize', resizeStage);
  resizeStage();

  /* ===================================================================
     3. AUTO-TRANSITION TIMER (첫 화면 인트로 후 다크 스테이지 전환)
     =================================================================== */
  let isModalOpen = false;
  let autoTimerId = null;

  function scheduleAutoTransition(delayMs) {
    clearTimeout(autoTimerId);
    autoTimerId = setTimeout(() => {
      if (!isModalOpen) {
        openInfoModal();
      }
    }, delayMs);
  }

  // 페이드인 완료 후 의무 대기 시간을 기존 5.5초에서 2.4초로 단축
  scheduleAutoTransition(2400);

  function onUserInteractCover() {
    if (isModalOpen) return;
    // 터치/클릭 시 지체 없이 즉시 다음 씬(다크 스테이지)으로 전환
    openInfoModal();
  }

  /* ===================================================================
     4. TOUCH & DRAG TRAIL MANAGEMENT
     =================================================================== */
  const trailNodes = [];
  const activePointers = new Map();

  function getLocalCoords(clientX, clientY) {
    const rect = appFrame.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function spawnTrailNode(x, y, now, pointerId = null) {
    for (let i = trailNodes.length - 1; i >= 0; i--) {
      const n = trailNodes[i];
      const dist = Math.hypot(n.x - x, n.y - y);
      if (dist < CHARCOAL_PARAMS.stepDistPx * 0.55) {
        n.lastActiveAt = now;
        if (pointerId !== null) n.pointerId = pointerId;
        return n;
      }
    }

    const node = {
      x,
      y,
      bornAt: now,
      lastActiveAt: now,
      pointerId,
    };
    trailNodes.push(node);
    return node;
  }

  function handlePointerDown(id, clientX, clientY) {
    if (!isModalOpen) {
      openInfoModal();
      return;
    }
    const now = performance.now();
    const { x, y } = getLocalCoords(clientX, clientY);
    const node = spawnTrailNode(x, y, now, id);
    activePointers.set(id, { x, y, node });
  }

  function handlePointerMove(id, clientX, clientY) {
    const state = activePointers.get(id);
    if (!state) return;

    const now = performance.now();
    const { x, y } = getLocalCoords(clientX, clientY);
    const dx = x - state.x;
    const dy = y - state.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2) {
      if (state.node) state.node.lastActiveAt = now;
      return;
    }

    if (state.node) {
      state.node.lastActiveAt = now;
      state.node.pointerId = null;
    }

    const steps = Math.max(1, Math.ceil(dist / CHARCOAL_PARAMS.stepDistPx));
    let lastNode = null;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const ix = state.x + dx * t;
      const iy = state.y + dy * t;
      lastNode = spawnTrailNode(ix, iy, now, s === steps ? id : null);
    }

    state.x = x;
    state.y = y;
    state.node = lastNode;
  }

  function handlePointerUp(id) {
    const state = activePointers.get(id);
    if (!state) return;
    const now = performance.now();
    if (state.node) {
      state.node.lastActiveAt = now;
      state.node.pointerId = null;
    }
    activePointers.delete(id);
  }

  coverStage.addEventListener('pointerdown', (e) => {
    if (!isModalOpen) {
      openInfoModal();
      return;
    }
    handlePointerDown(e.pointerId, e.clientX, e.clientY);
  });

  coverStage.addEventListener('click', () => {
    if (!isModalOpen) {
      openInfoModal();
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) {
      handlePointerMove(e.pointerId, e.clientX, e.clientY);
    }
  }, { passive: true });

  window.addEventListener('pointerup', (e) => {
    handlePointerUp(e.pointerId);
  }, { passive: true });

  window.addEventListener('pointercancel', (e) => {
    handlePointerUp(e.pointerId);
  }, { passive: true });

  /* ===================================================================
     5. RENDER LOOP: SOFT FEATHERED ALPHA MASK & DUAL DECAY (GREY vs RED)
     =================================================================== */
  function drawSoftBrush(targetCtx, x, y, radius, alpha) {
    if (alpha <= 0.002) return;
    const grad = targetCtx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0.0, `rgba(0, 0, 0, ${(alpha * 1.0).toFixed(4)})`);
    grad.addColorStop(0.24, `rgba(0, 0, 0, ${(alpha * 0.85).toFixed(4)})`);
    grad.addColorStop(0.50, `rgba(0, 0, 0, ${(alpha * 0.48).toFixed(4)})`);
    grad.addColorStop(0.74, `rgba(0, 0, 0, ${(alpha * 0.16).toFixed(4)})`);
    grad.addColorStop(0.90, `rgba(0, 0, 0, ${(alpha * 0.04).toFixed(4)})`);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    targetCtx.fillStyle = grad;
    targetCtx.beginPath();
    targetCtx.arc(x, y, radius, 0, Math.PI * 2);
    targetCtx.fill();
  }

  function compositeLayerWithMask(sourceLayerCanvas, decayMs, maxLayerAlpha, now, radiusScale = 1.0) {
    const pw = charcoalCanvas.width;
    const ph = charcoalCanvas.height;

    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maskCtx.clearRect(0, 0, viewW, viewH);
    maskCtx.globalCompositeOperation = 'source-over';

    let hasVisibleNodes = false;
    const r = brushRadius * radiusScale;

    for (let i = 0; i < trailNodes.length; i++) {
      const node = trailNodes[i];

      if (node.pointerId !== null && activePointers.has(node.pointerId)) {
        node.lastActiveAt = now;
      }

      const ageSinceBorn = now - node.bornAt;
      const ageSinceRelease = now - node.lastActiveAt;

      if (ageSinceRelease >= decayMs) continue;

      const fadeIn = Math.min(1, ageSinceBorn / CHARCOAL_PARAMS.fadeInMs);
      const progress = Math.max(0, Math.min(1, ageSinceRelease / decayMs));
      const fadeOut = Math.pow(1 - progress, 1.8);

      const nodeAlpha = fadeIn * fadeOut * 0.62;
      if (nodeAlpha > 0.003) {
        hasVisibleNodes = true;
        drawSoftBrush(maskCtx, node.x, node.y, r, nodeAlpha);
      }
    }

    if (!hasVisibleNodes) return;

    compCtx.setTransform(1, 0, 0, 1, 0, 0);
    compCtx.clearRect(0, 0, pw, ph);
    compCtx.globalCompositeOperation = 'source-over';
    compCtx.drawImage(sourceLayerCanvas, 0, 0);

    compCtx.globalCompositeOperation = 'destination-in';
    compCtx.drawImage(maskCanvas, 0, 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = maxLayerAlpha;
    ctx.drawImage(compCanvas, 0, 0);
    ctx.restore();
  }

  function renderLoop(now) {
    activePointers.forEach((state) => {
      if (state.node) {
        state.node.lastActiveAt = now;
      }
    });

    for (let i = trailNodes.length - 1; i >= 0; i--) {
      const n = trailNodes[i];
      const isHeld = n.pointerId !== null && activePointers.has(n.pointerId);
      if (!isHeld && now - n.lastActiveAt > CHARCOAL_PARAMS.redDecayMs + 100) {
        trailNodes.splice(i, 1);
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, charcoalCanvas.width, charcoalCanvas.height);

    if (isAssetLoaded && trailNodes.length > 0) {
      compositeLayerWithMask(
        screenGreyCanvas,
        CHARCOAL_PARAMS.greyDecayMs,
        CHARCOAL_PARAMS.greyMaxAlpha,
        now,
        1.0
      );

      compositeLayerWithMask(
        screenRedCanvas,
        CHARCOAL_PARAMS.redDecayMs,
        CHARCOAL_PARAMS.redMaxAlpha,
        now,
        1.06
      );
    }

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);

  /* ===================================================================
     6. FIXED-STAGE SCENE CONTROLLER (글씨만 제자리에서 뿅뿅 올라오는 전환)
     =================================================================== */
  let currentScene = 0;
  let sceneLocked = false;
  const LAST_SCENE = scenes.length - 1; // 5 (Unified Info Page)

  function updatePageDots(activeIdx) {
    pageDots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === activeIdx);
    });
  }

  const infoPopItems = unifiedInfoScroll
    ? Array.from(unifiedInfoScroll.querySelectorAll('.pop-item'))
    : [];

  function checkInfoItemsReveal() {
    if (currentScene !== LAST_SCENE || !unifiedInfoScroll) return;
    const containerRect = unifiedInfoScroll.getBoundingClientRect();
    let delayIdx = 0;

    infoPopItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      // 화면 하단 기준 88% 안쪽으로 들어오면 뿅 올라오도록 처리
      if (rect.top < containerRect.bottom - containerRect.height * 0.08) {
        if (!item.classList.contains('is-revealed')) {
          const d = delayIdx * 130;
          delayIdx++;
          setTimeout(() => {
            if (currentScene === LAST_SCENE) {
              item.classList.add('is-revealed');
            }
          }, d);
        }
      }
    });
  }

  if (unifiedInfoScroll) {
    unifiedInfoScroll.addEventListener('scroll', checkInfoItemsReveal, { passive: true });
  }

  function showScene(nextIdx) {
    if (nextIdx < 0 || nextIdx > LAST_SCENE) return;
    currentScene = nextIdx;

    if (currentScene === LAST_SCENE && unifiedInfoScroll) {
      unifiedInfoScroll.scrollTop = 0;
      infoPopItems.forEach((item) => item.classList.remove('is-revealed'));
      setTimeout(checkInfoItemsReveal, 80);
    }

    scenes.forEach((sc, i) => {
      sc.classList.toggle('is-active', i === currentScene);
    });

    updatePageDots(currentScene);

    sceneLocked = true;
    setTimeout(() => {
      sceneLocked = false;
    }, 620);
  }

  function openInfoModal() {
    if (isModalOpen) return;
    isModalOpen = true;
    clearTimeout(autoTimerId);

    // 모달이 열릴 때 Scene 0의 글씨들이 뿅뿅 올라오도록 리셋 후 활성화
    scenes.forEach((sc) => sc.classList.remove('is-active'));
    infoModal.classList.add('is-open');
    infoModal.setAttribute('aria-hidden', 'false');
    if (themeColorMeta) themeColorMeta.setAttribute('content', '#000000');

    // 검정 배경이 스며들며 첫 씬 텍스트가 경쾌하고 우아하게 등장
    setTimeout(() => {
      if (isModalOpen) {
        showScene(0);
      }
    }, 450);
  }

  function closeInfoModal() {
    if (!isModalOpen) return;
    isModalOpen = false;
    infoModal.classList.remove('is-open');
    infoModal.setAttribute('aria-hidden', 'true');
    if (themeColorMeta) themeColorMeta.setAttribute('content', '#ffffff');
    scheduleAutoTransition(2500);
  }

  closeInfoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeInfoModal();
  });

  // 마우스 휠로 장면 전환 (화면은 고정, 글씨만 뿅뿅 올라옴)
  window.addEventListener('wheel', (e) => {
    if (!isModalOpen || sceneLocked) return;
    if (mapActionBackdrop.classList.contains('is-open')) return;

    // 마지막 통합 정보 장면에서는 내부 스크롤 허용하되, 최상단에서 위로 굴리면 이전 장면으로 이동
    if (currentScene === LAST_SCENE && unifiedInfoScroll) {
      if (e.deltaY < -35 && unifiedInfoScroll.scrollTop <= 2) {
        showScene(currentScene - 1);
      }
      return;
    }

    if (e.deltaY > 25) {
      if (currentScene < LAST_SCENE) {
        showScene(currentScene + 1);
      }
    } else if (e.deltaY < -25) {
      if (currentScene > 0) {
        showScene(currentScene - 1);
      } else {
        closeInfoModal();
      }
    }
  }, { passive: true });

  // 모바일 터치 스와이프 및 탭으로 장면 전환
  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartTime = 0;

  scenesStage.addEventListener('touchstart', (e) => {
    if (!isModalOpen) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchStartTime = Date.now();
  }, { passive: true });

  scenesStage.addEventListener('touchend', (e) => {
    if (!isModalOpen || sceneLocked) return;
    if (mapActionBackdrop.classList.contains('is-open')) return;

    const dy = e.changedTouches[0].clientY - touchStartY;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dt = Date.now() - touchStartTime;

    // 마지막 통합 정보 장면일 때: 스크롤 최상단에서 아래로 당길 때만 이전 장면으로 이동
    if (currentScene === LAST_SCENE && unifiedInfoScroll) {
      if (dy > 75 && unifiedInfoScroll.scrollTop <= 2) {
        showScene(currentScene - 1);
      }
      return;
    }

    // 가벼운 탭으로도 다음 장면 글씨가 뿅뿅 올라오도록 지원
    if (Math.hypot(dx, dy) < 10 && dt < 350) {
      if (e.target.closest('button') || e.target.closest('a')) return;
      if (currentScene < LAST_SCENE) {
        showScene(currentScene + 1);
      }
      return;
    }

    // 위로 스와이프 (스크롤 내리기) -> 다음 장면 글씨 뿅뿅 올라옴
    if (dy < -40) {
      if (currentScene < LAST_SCENE) {
        showScene(currentScene + 1);
      }
    }
    // 아래로 스와이프 (스크롤 올리기) -> 이전 장면으로
    else if (dy > 40) {
      if (currentScene > 0) {
        showScene(currentScene - 1);
      } else {
        closeInfoModal();
      }
    }
  }, { passive: true });

  // 데스크톱 클릭으로도 다음 장면 넘기기 지원
  scenesStage.addEventListener('click', (e) => {
    if (!isModalOpen || sceneLocked) return;
    if (currentScene === LAST_SCENE) return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('#mapInteractiveBox')) return;
    if (currentScene < LAST_SCENE) {
      showScene(currentScene + 1);
    }
  });

  /* ===================================================================
     7. ADDRESS COPY & MAP APP LINK ACTION SHEET
     =================================================================== */
  let toastTimer = null;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2200);
  }

  function copyAddressToClipboard() {
    const address = '서울 서초구 서초대로38길 15';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(address).then(() => {
        showToast('주소가 클립보드에 복사되었습니다.');
      }).catch(() => {
        fallbackCopy(address);
      });
    } else {
      fallbackCopy(address);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('주소가 클립보드에 복사되었습니다.');
    } catch (_) {
      showToast(text);
    }
    document.body.removeChild(ta);
  }

  function openMapActionSheet() {
    mapActionBackdrop.classList.add('is-open');
    mapActionBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeMapActionSheet() {
    mapActionBackdrop.classList.remove('is-open');
    mapActionBackdrop.setAttribute('aria-hidden', 'true');
  }

  venueCopyTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    copyAddressToClipboard();
    openMapActionSheet();
  });

  mapInteractiveBox.addEventListener('click', (e) => {
    e.stopPropagation();
    openMapActionSheet();
  });

  btnCopyAddress.addEventListener('click', () => {
    copyAddressToClipboard();
    closeMapActionSheet();
  });

  btnCloseAction.addEventListener('click', closeMapActionSheet);
  mapActionBackdrop.addEventListener('click', (e) => {
    if (e.target === mapActionBackdrop) {
      closeMapActionSheet();
    }
  });
})();
