/* ─── KangPOS Landing — main.js ─── */

/* ── Mobile nav ── */
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobile-menu");

hamburger?.addEventListener("click", () => {
  mobileMenu?.classList.toggle("open");
  const isOpen = mobileMenu?.classList.contains("open");
  hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
});

/* Close mobile menu on link click */
mobileMenu?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => mobileMenu.classList.remove("open"));
});

/* ── Active nav link on scroll ── */
const sections = document.querySelectorAll("section[id]");
const navLinks  = document.querySelectorAll(".nav-link[href^='#']");

function updateActiveLink() {
  const scrollY = window.scrollY + 100;
  sections.forEach(sec => {
    const top    = sec.offsetTop;
    const height = sec.offsetHeight;
    const id     = sec.getAttribute("id");
    if (scrollY >= top && scrollY < top + height) {
      navLinks.forEach(l => {
        l.classList.toggle("active", l.getAttribute("href") === `#${id}`);
      });
    }
  });
}
window.addEventListener("scroll", updateActiveLink, { passive: true });
updateActiveLink();

/* ── Scroll fade-in animations ── */
const fadeEls = document.querySelectorAll(".fade-up");
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("visible");
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

fadeEls.forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  observer.observe(el);
});

/* ── Contact form ── */
const contactForm    = document.getElementById("contact-form");
const formSuccess    = document.getElementById("form-success");
const formFields     = document.getElementById("form-fields");

contactForm?.addEventListener("submit", e => {
  e.preventDefault();

  const name    = document.getElementById("f-name")?.value || "";
  const email   = document.getElementById("f-email")?.value || "";
  const venue   = document.getElementById("f-venue")?.value || "";
  const topic   = document.getElementById("f-topic")?.value || "";
  const message = document.getElementById("f-message")?.value || "";

  const subject = encodeURIComponent(`KangPOS Enquiry — ${topic || "General"} from ${name}`);
  const body = encodeURIComponent(
    `Name: ${name}\nEmail: ${email}\nBusiness: ${venue}\nTopic: ${topic}\n\nMessage:\n${message}`
  );

  window.location.href = `mailto:pahulpreet2959@gmail.com?subject=${subject}&body=${body}`;

  formFields?.classList.add("hidden");
  formSuccess?.classList.add("show");
});

/* ── Smooth scroll for all anchor buttons in hero ── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", e => {
    const target = document.querySelector(anchor.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

/* ── Nav scroll shadow ── */
const nav = document.querySelector(".nav");
window.addEventListener("scroll", () => {
  nav?.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });
