window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  setTimeout(() => {
    preloader.classList.add('hidden');
  }, 800);
});


const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  lastScroll = currentScroll;
});


const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('active');
  hamburger.setAttribute('aria-expanded', hamburger.classList.contains('active'));
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});


const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach((section) => {
    const sectionTop = section.offsetTop - 120;
    if (window.pageYOffset >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navLinks.querySelectorAll('a:not(.nav-cta)').forEach((link) => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
});

const counters = document.querySelectorAll('.stat-number, .stat-number-big');

const animateCounters = () => {
  counters.forEach((counter) => {
    const target = parseInt(counter.getAttribute('data-count'));
    const duration = 2000;
    const step = Math.max(1, Math.floor(target / 60));
    let current = 0;

    const updateCounter = () => {
      current += step;
      if (current >= target) {
        counter.textContent = target;
        return;
      }
      counter.textContent = current;
      requestAnimationFrame(updateCounter);
    };

    updateCounter();
  });
};


let countersAnimated = false;

const observerOptions = {
  threshold: 0.5,
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && !countersAnimated) {
      countersAnimated = true;
      animateCounters();
    }
  });
}, observerOptions);

const statsSection = document.querySelector('.hero-trust');
if (statsSection) {
  observer.observe(statsSection);
}


const aboutStatsSection = document.querySelector('.about-stats-grid');
if (aboutStatsSection) {
  const aboutObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !countersAnimated) {
        countersAnimated = true;
        animateCounters();
      }
    });
  }, observerOptions);
  aboutObserver.observe(aboutStatsSection);
}


const track = document.getElementById('testimonialTrack');
const dots = document.querySelectorAll('.dot');
let currentSlide = 0;
let autoSlideInterval;

const startAutoSlide = () => {
  autoSlideInterval = setInterval(() => {
    goToSlide(currentSlide + 1);
  }, 5000);
};

const goToSlide = (index) => {
  if (index < 0) index = 0;
  if (index >= dots.length) index = 0;

  currentSlide = index;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSlide);
    dot.setAttribute('aria-current', i === currentSlide ? 'true' : 'false');
  });
};

if (dots.length > 0) {
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      clearInterval(autoSlideInterval);
      goToSlide(index);
      startAutoSlide();
    });
  });

  startAutoSlide();
}

const previousTestimonial = document.getElementById('prevTestimonial');
const nextTestimonial = document.getElementById('nextTestimonial');

const changeSlide = (direction) => {
  clearInterval(autoSlideInterval);
  goToSlide(currentSlide + direction);
  if (dots.length > 0) startAutoSlide();
};

if (previousTestimonial) {
  previousTestimonial.addEventListener('click', () => changeSlide(-1));
}

if (nextTestimonial) {
  nextTestimonial.addEventListener('click', () => changeSlide(1));
}

document.querySelectorAll('.faq-question').forEach((question) => {
  question.addEventListener('click', () => {
    const item = question.closest('.faq-item');
    const isOpen = item.classList.toggle('active');
    question.setAttribute('aria-expanded', isOpen);
  });
});


const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  if (window.pageYOffset > 500) {
    backToTop.classList.add('visible');
  } else {
    backToTop.classList.remove('visible');
  }
});

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});


AOS.init({
  duration: 800,
  once: true,
  offset: 100,
});


document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;

    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      e.preventDefault();
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  });
});

// ----- WHATSAPP BUTTON TRACKING (Optional Analytics) -----
document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
  link.addEventListener('click', function () {
    console.log('WhatsApp clicked: ' + this.href);
    // You can add Google Analytics or Facebook Pixel tracking here
  });
});

console.log(' LLCT Solutions website loaded successfully!');
