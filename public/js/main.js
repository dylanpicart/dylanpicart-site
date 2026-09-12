/* ============================================================
   main.js — all client interactions
   1. Hero slogan word stagger
   2. Pipeline spine: draws with scroll, nodes light up
   3. Project list: floating preview card follows the cursor
   4. .reveal elements fade/slide in on scroll
   5. Image carousels (no dependencies)
   Everything respects prefers-reduced-motion.
   ============================================================ */

/* ---------- 5. Image carousels (defined first, no GSAP needed) ---------- */
function initCarousels() {
  document.querySelectorAll('.img-carousel').forEach(function(carousel) {
    var slides = Array.from(carousel.querySelectorAll('figure'));
    if (slides.length < 2) return;

    var current = 0;

    var controls = document.createElement('div');
    controls.className = 'img-carousel-controls';

    var prev = document.createElement('button');
    prev.className = 'carousel-btn carousel-prev';
    prev.setAttribute('aria-label', 'Previous image');
    prev.innerHTML = '&#8592; Prev';

    var next = document.createElement('button');
    next.className = 'carousel-btn carousel-next';
    next.setAttribute('aria-label', 'Next image');
    next.innerHTML = 'Next &#8594;';

    var counter = document.createElement('span');
    counter.className = 'carousel-counter';

    controls.append(prev, counter, next);
    carousel.appendChild(controls);

    function show(index) {
      slides.forEach(function(s, i) {
        s.hidden = i !== index;
        s.setAttribute('aria-hidden', String(i !== index));
      });
      counter.textContent = (index + 1) + ' / ' + slides.length;
      prev.disabled = index === 0;
      next.disabled = index === slides.length - 1;
    }

    prev.addEventListener('click', function() { if (current > 0) show(--current); });
    next.addEventListener('click', function() { if (current < slides.length - 1) show(++current); });

    carousel.setAttribute('tabindex', '0');
    carousel.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft'  && current > 0)                show(--current);
      if (e.key === 'ArrowRight' && current < slides.length - 1) show(++current);
    });

    show(0);
  });
}

// Run carousels immediately — no GSAP dependency
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCarousels);
} else {
  initCarousels();
}

(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  /* ---------- 1. Hero word stagger ---------- */
  var words = document.querySelectorAll('#slogan .word');
  if (words.length && !reduceMotion) {
    gsap.from(words, {
      y: 40,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.09,
    });
  }

  /* ---------- 2. Pipeline spine ---------- */
  var spine = document.querySelector('.spine');
  if (spine) {
    var flow = spine.querySelector('.flow');
    var nodes = spine.querySelectorAll('.node');

    function placeNodes() {
      var docH = document.documentElement.scrollHeight;
      nodes.forEach(function(node) {
        var sec = document.getElementById(node.dataset.section);
        if (!sec) return;
        var mid = sec.offsetTop + sec.offsetHeight / 2;
        node.style.top = (mid / docH) * 100 + '%';
      });
    }
    placeNodes();
    window.addEventListener('resize', placeNodes);

    if (!reduceMotion && typeof ScrollTrigger !== 'undefined') {
      gsap.to(flow, {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.4 },
      });
    } else {
      flow.style.transform = 'scaleY(1)';
    }

    nodes.forEach(function(node) {
      var sec = document.getElementById(node.dataset.section);
      if (!sec) return;
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.create({
          trigger: sec,
          start: 'top center',
          end: 'bottom center',
          onToggle: function(self) { node.classList.toggle('active', self.isActive); },
        });
      }
    });
  }

  /* ---------- 3. Project list hover preview ---------- */
  var list = document.getElementById('project-list');
  var preview = document.getElementById('preview');
  if (list && preview) {
    var textEl = document.getElementById('preview-text');
    var chipsEl = document.getElementById('preview-chips');
    var canHover = window.matchMedia('(hover: hover)').matches;

    if (canHover && !reduceMotion) {
      var xTo = gsap.quickTo(preview, 'x', { duration: 0.35, ease: 'power3' });
      var yTo = gsap.quickTo(preview, 'y', { duration: 0.35, ease: 'power3' });

      list.addEventListener('mousemove', function(e) {
        xTo(e.clientX + 24);
        yTo(e.clientY - 40);
      });

      list.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('mouseenter', function() {
          list.classList.add('dimmed');
          textEl.textContent = link.dataset.description || '';
          chipsEl.innerHTML = (link.dataset.langs || '')
            .split(',')
            .filter(Boolean)
            .map(function(l) { return '<span class="chip ' + l.trim().toLowerCase() + '">' + l.trim() + '</span>'; })
            .join('');
          gsap.to(preview, { opacity: 1, scale: 1, duration: 0.25 });
        });
        link.addEventListener('mouseleave', function() {
          list.classList.remove('dimmed');
          gsap.to(preview, { opacity: 0, scale: 0.9, duration: 0.2 });
        });
      });
    }
  }

  /* ---------- 4. Scroll reveals ---------- */
  if (!reduceMotion && typeof ScrollTrigger !== 'undefined') {
    document.querySelectorAll('.reveal').forEach(function(el) {
      gsap.from(el, {
        y: 36,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 82%' },
      });
    });
  }
})();
