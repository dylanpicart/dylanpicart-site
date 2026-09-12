/**
 * contact.js — contact form validation + profanity filtering
 *
 * Uses leo-profanity (MIT, npm) for the wordlist so we're not
 * maintaining our own list. The wordlist ships to the browser
 * intentionally — client-side filtering catches honest mistakes
 * and provides UX feedback; Formspree's own spam filter + reCAPTCHA
 * is the real backend gate.
 *
 * To truly hide a wordlist you need a serverless function between
 * the form and Formspree — overkill for a portfolio contact form.
 */

import leoProfanity from 'leo-profanity';

// Load the full English dictionary (includes US + GB slurs/profanity)
leoProfanity.loadDictionary('en');

// ── Validators ────────────────────────────────────────────────────────────

export function validateName(value) {
  const v = value.trim();
  if (v.length < 2)
    return 'Name must be at least 2 characters.';
  if (v.length > 80)
    return 'Name is too long (max 80 characters).';
  // Unicode-aware: passes accented, non-Latin, hyphenated, apostrophe names
  if (!/^[\p{L}\p{M} '\-\.]+$/u.test(v))
    return 'Name contains unexpected characters.';
  if (leoProfanity.check(v))
    return 'Please keep the name field professional.';
  return '';
}

export function validateEmail(value) {
  const v = value.trim();
  if (!v)
    return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
    return 'Please enter a valid email address.';
  return '';
}

export function validateMessage(value) {
  const v = value.trim();
  if (v.length < 20)
    return 'Message is too short — at least 20 characters please.';
  if (v.length > 3000)
    return 'Message is too long (max 3,000 characters).';
  // Gibberish check: fewer than 40% letter characters flags bot noise.
  // \p{L} counts letters in any script — Arabic, Spanish, Haitian Creole, etc.
  const letters = (v.match(/\p{L}/gu) || []).length;
  if (letters / v.length < 0.4)
    return "Message doesn't look like natural language — please try again.";
  if (leoProfanity.check(v))
    return 'Please keep your message professional.';
  return '';
}

// ── DOM wiring ────────────────────────────────────────────────────────────

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}

export function initContactForm() {
  const form    = document.getElementById('contact-form');
  const nameEl  = document.getElementById('cf-name');
  const emailEl = document.getElementById('cf-email');
  const msgEl   = document.getElementById('cf-message');
  const submit  = document.getElementById('cf-submit');
  const status  = document.getElementById('cf-status');
  const counter = document.getElementById('char-count');

  if (!form) return; // not on a page that has the contact form

  // Live character counter
  msgEl.addEventListener('input', () => {
    const n = msgEl.value.length;
    counter.textContent = `${n} / 3000`;
    counter.style.color = n > 3000 ? 'var(--html-orange)' : 'var(--ink-soft)';
  });

  // Validate on blur (not on every keystroke — mid-typing errors are annoying)
  nameEl.addEventListener('blur',  () => showError('err-name',    validateName(nameEl.value)));
  emailEl.addEventListener('blur', () => showError('err-email',   validateEmail(emailEl.value)));
  msgEl.addEventListener('blur',   () => showError('err-message', validateMessage(msgEl.value)));

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameErr  = validateName(nameEl.value);
    const emailErr = validateEmail(emailEl.value);
    const msgErr   = validateMessage(msgEl.value);

    showError('err-name',    nameErr);
    showError('err-email',   emailErr);
    showError('err-message', msgErr);

    if (nameErr || emailErr || msgErr) return;

    submit.disabled = true;
    submit.textContent = 'Sending…';
    status.textContent = '';
    status.className = 'status';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });

      if (res.ok) {
        status.textContent = "✓ Message sent! I'll get back to you soon.";
        status.className = 'status ok';
        form.reset();
        counter.textContent = '0 / 3000';
      } else {
        throw new Error('server');
      }
    } catch {
      status.textContent =
        'Something went wrong — try emailing me directly.';
      status.className = 'status error';
      submit.disabled = false;
      submit.textContent = 'Get in touch';
    }
  });
}
