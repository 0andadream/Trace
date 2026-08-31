import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const BLOCK_SCROLL_VH = 240;
const SCRUB_SMOOTHING = 0.45;
const UNFOLD_WEIGHT = 0.18;
const TITLE_EXIT_WEIGHT = 0.14;
const LAND_WEIGHT = 0.1;
const BENEFIT_ENTRY_WEIGHT = 0.08;
const BENEFIT_MOVE_WEIGHTS = [0.26, 0.26];
const FINAL_DWELL_WEIGHT = 0.12;
const MOVE_LEAD_FRACTION = 0.08;
const COPY_OUT_AT = 0.08;
const COPY_OUT_FRACTION = 0.2;
const COPY_IN_AT = 0.48;
const COPY_IN_FRACTION = 0.34;
const PHONE_MOVE_FRACTION = 0.58;
const SNAP_DELAY = 0.12;
const MOVE = 0.3;
const REST_DEG = 12;
const MOBILE_BLOCK_VH = 200;
const MOBILE_SCRUB = 0.55;

const SCREEN_STEPS: ({ from: "right" | "bottom"; dim: number } | null)[] = [
  null,
  { from: "bottom", dim: 0.2 },
  { from: "right", dim: 0.1 },
];

function desktop() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function buildHowStory(holdEl: HTMLElement) {
  holdEl.classList.remove("how-story", "how-story-mobile");
  if (reduced()) {
    return () => {};
  }

  const isDesktop = desktop();
  holdEl.classList.add("how-story");
  if (!isDesktop) holdEl.classList.add("how-story-mobile");

  const slotEl = holdEl.querySelector<HTMLElement>(".how-slot");
  const maskEl = holdEl.querySelector<HTMLElement>(".how-mask");
  const line1 = holdEl.querySelector<HTMLElement>(".how-line-1");
  const line2 = holdEl.querySelector<HTMLElement>(".how-line-2");
  const maskCopy = holdEl.querySelector<HTMLElement>(".how-mask-copy");
  const maskPhone = holdEl.querySelector<HTMLElement>(".how-mask-phone");
  const leanEl = holdEl.querySelector<HTMLElement>(".how-phone-lean");
  const lines = holdEl.querySelectorAll<HTMLElement>(".how-copy-lines > p");
  const layers = Array.from(holdEl.querySelectorAll<HTMLElement>(".how-screen-layer"));
  const posters = Array.from(holdEl.querySelectorAll<HTMLElement>(".how-poster"));
  const dim = holdEl.querySelector<HTMLElement>(".how-screen-dim");

  if (!slotEl || !maskEl || !line1 || !line2 || !maskPhone || !maskCopy || lines.length < 3) {
    holdEl.classList.remove("how-story");
    return () => {};
  }

  const slot = slotEl;
  const mask = maskEl;
  const title1 = line1;
  const title2 = line2;
  const phone = maskPhone;
  const copyHead = maskCopy;

  const ctx = gsap.context(() => {
    const unfoldProxy = { p: 0 };
    const screenPose = { i: 0 };
    let shownIdx = 0;

    function slotInset() {
      let t = 0;
      for (let el: HTMLElement | null = slot; el && el !== holdEl; el = el.offsetParent as HTMLElement | null) {
        t += el.offsetTop;
      }
      const sw = slot.offsetWidth;
      const sh = slot.offsetHeight;
      const l = (holdEl.clientWidth - sw) / 2;
      const r = holdEl.clientWidth - l - sw;
      const b = holdEl.clientHeight - t - sh;
      return { t, r, b, l };
    }

    function unfoldClip(p: number) {
      const s = slotInset();
      const it = s.t * (1 - p);
      const ir = s.r * (1 - p);
      const ib = s.b * (1 - p);
      const il = s.l * (1 - p);
      const w = holdEl.clientWidth - il - ir;
      const h = holdEl.clientHeight - it - ib;
      const rad = (Math.min(w, h) / 2) * (1 - p);
      return `inset(${it}px ${ir}px ${ib}px ${il}px round ${rad}px)`;
    }

    function slotShiftPct() {
      let l = 0;
      for (let el: HTMLElement | null = slot; el && el !== holdEl; el = el.offsetParent as HTMLElement | null) {
        l += el.offsetLeft;
      }
      const shiftPx = holdEl.clientWidth / 2 - (l + slot.offsetWidth / 2);
      return title1.offsetWidth ? (shiftPx / title1.offsetWidth) * 100 : 0;
    }

    const D = () => Math.min(window.innerWidth * 0.19, 300);
    const LANE_GAP = () => Math.max(64, Math.min(window.innerWidth * 0.07, 120));

    function syncCopyLanes() {
      const sec = holdEl.getBoundingClientRect();
      const p = phone.getBoundingClientRect();
      const gap = LANE_GAP();
      holdEl.style.setProperty("--lane-left", `${p.right - sec.left + gap}px`);
      holdEl.style.setProperty("--lane-right", `${sec.right - p.left + gap}px`);
    }

    const sideOf = (i: number) => (i % 2 ? 1 : -1);
    const leanFor = (side: number) => side * REST_DEG;

    function settlePosters(i: number) {
      posters.forEach((el, n) => {
        gsap.set(el, { autoAlpha: n === i ? 1 : 0, zIndex: n === i ? 2 : 1 });
      });
    }

    function settleLayers(i: number) {
      layers.forEach((el, n) => {
        gsap.set(el, {
          xPercent: 0,
          yPercent: 0,
          autoAlpha: n === i ? 1 : 0,
          zIndex: n === i ? 2 : 1,
          pointerEvents: n === i ? "auto" : "none",
        });
      });
      settlePosters(i);
      if (dim) gsap.set(dim, { opacity: 0 });
    }

    function showScreen(i: number) {
      if (i === shownIdx || !layers[i]) return;
      const prev = shownIdx;
      const forward = i > prev;
      shownIdx = i;
      settlePosters(i);
      if (Math.abs(i - prev) > 1 || !layers[prev]) {
        settleLayers(i);
        return;
      }
      const step = SCREEN_STEPS[forward ? i : prev];
      if (!step) {
        settleLayers(i);
        return;
      }
      const over = layers[forward ? i : prev];
      const under = layers[forward ? prev : i];
      gsap.killTweensOf([over, under, dim].filter(Boolean));
      if (forward) {
        gsap.set(over, {
          autoAlpha: 1,
          zIndex: 3,
          xPercent: step.from === "right" ? 100 : 0,
          yPercent: step.from === "bottom" ? 100 : 0,
        });
        gsap.set(under, { autoAlpha: 1, zIndex: 1, xPercent: 0, yPercent: 0 });
        if (dim) gsap.to(dim, { opacity: step.dim, duration: MOVE, ease: "power2.inOut" });
        gsap.to(over, {
          xPercent: 0,
          yPercent: 0,
          duration: MOVE,
          ease: "power2.inOut",
          onComplete: () => {
            gsap.set(under, { autoAlpha: 0 });
            if (dim) gsap.set(dim, { opacity: 0 });
          },
        });
      } else {
        gsap.set(over, { autoAlpha: 1, zIndex: 3, xPercent: 0, yPercent: 0 });
        gsap.set(under, { autoAlpha: 1, zIndex: 1, xPercent: 0, yPercent: 0 });
        if (dim) gsap.to(dim, { opacity: 0, duration: MOVE, ease: "power2.inOut" });
        gsap.to(over, {
          xPercent: step.from === "right" ? 100 : 0,
          yPercent: step.from === "bottom" ? 100 : 0,
          duration: MOVE,
          ease: "power2.inOut",
          onComplete: () => gsap.set(over, { autoAlpha: 0, xPercent: 0, yPercent: 0 }),
        });
      }
    }

    settleLayers(0);
    if (isDesktop && leanEl) gsap.set(leanEl, { rotateY: leanFor(-1) });

    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: holdEl,
          start: "top 95%",
          end: isDesktop ? "top -15%" : "top 8%",
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
      .fromTo(title1, { xPercent: 110 }, { xPercent: () => slotShiftPct() }, 0)
      .fromTo(
        title2,
        { xPercent: () => -1.15 * (110 - slotShiftPct()) },
        { xPercent: 0 },
        0,
      );

    const TITLE_EXIT_AT = UNFOLD_WEIGHT - TITLE_EXIT_WEIGHT;
    const LAND_AT = UNFOLD_WEIGHT;
    const BENEFIT_ENTRY_AT = LAND_AT + LAND_WEIGHT;
    const S0_AT = BENEFIT_ENTRY_AT + BENEFIT_ENTRY_WEIGHT;

    let blockTimeline: gsap.core.Timeline;
    blockTimeline = gsap.timeline({
      defaults: { ease: "none" },
      onUpdate: () => {
        showScreen(screenPose.i);
        if (isDesktop) syncCopyLanes();
      },
      scrollTrigger: {
        trigger: holdEl,
        start: isDesktop ? "top -15%" : "top 8%",
        end: () => `+=${isDesktop ? BLOCK_SCROLL_VH : MOBILE_BLOCK_VH}%`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: isDesktop ? SCRUB_SMOOTHING : MOBILE_SCRUB,
        ...(isDesktop
          ? {
              snap: {
                snapTo: "labelsDirectional" as const,
                duration: { min: 0.25, max: 0.65 },
                delay: SNAP_DELAY,
                inertia: true,
                ease: "power2.inOut",
              },
            }
          : {}),
        invalidateOnRefresh: true,
        onRefresh: () => {
          blockTimeline.render(blockTimeline.time(), false, true);
          if (isDesktop) syncCopyLanes();
        },
      },
    });

    blockTimeline
      .set(slot, { visibility: "hidden" }, 0.001)
      .set(mask, { opacity: 1 }, 0.001)
      .set(phone, { x: isDesktop ? () => -D() : 0 }, 0.001)
      .set(leanEl || phone, { rotateY: isDesktop ? leanFor(-1) : 0 }, 0.001)
      .fromTo(
        unfoldProxy,
        { p: 0 },
        {
          p: 1,
          duration: UNFOLD_WEIGHT,
          ease: "power2.inOut",
          onUpdate: () => {
            mask.style.clipPath = unfoldClip(unfoldProxy.p);
          },
        },
        0,
      )
      .to(title1, { xPercent: -140, ease: "power1.in", duration: TITLE_EXIT_WEIGHT }, TITLE_EXIT_AT)
      .to(title2, { xPercent: 140, ease: "power1.in", duration: TITLE_EXIT_WEIGHT }, TITLE_EXIT_AT)
      .fromTo(
        copyHead,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: LAND_WEIGHT, ease: "expo.out" },
        LAND_AT,
      )
      .fromTo(
        phone,
        { y: () => window.innerHeight },
        { y: 0, duration: LAND_WEIGHT, ease: "expo.out" },
        LAND_AT,
      )
      .fromTo(
        lines[0],
        { opacity: 0, x: isDesktop ? 28 : 0, y: isDesktop ? 0 : 16 },
        { opacity: 1, x: 0, y: 0, duration: BENEFIT_ENTRY_WEIGHT, ease: "power2.out" },
        BENEFIT_ENTRY_AT,
      )
      .addLabel("s0", S0_AT);

    let moveAt = S0_AT;
    [1, 2].forEach((i, moveIndex) => {
      const to = sideOf(i);
      const weight = BENEFIT_MOVE_WEIGHTS[moveIndex];
      const moveEnd = moveAt + weight;
      if (isDesktop) {
        blockTimeline
          .to(
            phone,
            {
              x: () => to * D(),
              duration: weight * PHONE_MOVE_FRACTION,
              ease: "power1.inOut",
            },
            moveAt + weight * MOVE_LEAD_FRACTION,
          )
          .to(
            leanEl || phone,
            {
              rotateY: leanFor(to),
              duration: weight * PHONE_MOVE_FRACTION,
              ease: "power1.inOut",
            },
            moveAt + weight * MOVE_LEAD_FRACTION,
          );
      }
      blockTimeline
        .fromTo(
          lines[i - 1],
          { opacity: 1 },
          {
            opacity: 0,
            duration: weight * COPY_OUT_FRACTION,
            ease: "power1.inOut",
            immediateRender: false,
          },
          moveAt + weight * COPY_OUT_AT,
        )
        .fromTo(
          lines[i],
          { opacity: 0, x: isDesktop ? -to * 28 : 0, y: isDesktop ? 0 : 16 },
          {
            opacity: 1,
            x: 0,
            y: 0,
            duration: weight * COPY_IN_FRACTION,
            ease: "power2.out",
            immediateRender: false,
          },
          moveAt + weight * COPY_IN_AT,
        )
        .set(screenPose, { i }, moveAt + weight * COPY_IN_AT);

      if (i === 2) {
        if (isDesktop) {
          blockTimeline.to(
            phone,
            { x: () => to * D(), duration: FINAL_DWELL_WEIGHT, ease: "none" },
            moveEnd,
          );
        } else {
          blockTimeline.to(phone, { y: 0, duration: FINAL_DWELL_WEIGHT, ease: "none" }, moveEnd);
        }
        blockTimeline.addLabel("s2", moveEnd + FINAL_DWELL_WEIGHT);
      } else {
        blockTimeline.addLabel("s1", moveEnd);
      }
      moveAt = moveEnd;
    });

    if (isDesktop) syncCopyLanes();
    ScrollTrigger.refresh();
  }, holdEl);

  return () => {
    ctx.revert();
    holdEl.classList.remove("how-story", "how-story-mobile");
    holdEl.style.removeProperty("--lane-left");
    holdEl.style.removeProperty("--lane-right");
  };
}
