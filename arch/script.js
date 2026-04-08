// Initialize Mermaid for diagrams
mermaid.initialize({ startOnLoad: true, theme: 'default' });

// Smooth scroll behavior
document.addEventListener('DOMContentLoaded', () => {
    // Intersection Observer for fade-in animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });

    // Counter animation for stats
    const statElements = document.querySelectorAll('.stat h3');
    const observerStats = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                entry.target.dataset.counted = 'true';
                animateCounter(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statElements.forEach(element => observerStats.observe(element));

    // Interactive cards
    const cards = document.querySelectorAll('.objective, .feature, .ai-feature, .stat, .metric');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.cursor = 'pointer';
        });

        card.addEventListener('click', function() {
            this.classList.toggle('expanded');
        });
    });

    // Add tooltip functionality
    addTooltips();

    // Parallax effect on scroll
    addParallaxEffect();
});

// Counter animation function
function animateCounter(element) {
    const text = element.textContent.trim();
    const isPercentage = text.includes('%');
    const isMoney = text.includes('$');
    const isTime = text.includes('sec');
    
    let numericValue = parseFloat(text);
    const finalValue = numericValue;
    let currentValue = 0;
    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepValue = finalValue / steps;
    const stepDuration = duration / steps;

    const timer = setInterval(() => {
        currentValue += stepValue;
        if (currentValue >= finalValue) {
            element.textContent = text;
            clearInterval(timer);
        } else {
            let displayValue = Math.floor(currentValue);
            if (isMoney) element.textContent = '$' + displayValue + 'B+';
            else if (isPercentage) element.textContent = Math.floor(currentValue) + '%';
            else if (isTime) element.textContent = displayValue + ' sec';
            else element.textContent = displayValue + 'M';
        }
    }, stepDuration);
}

// Add hover tooltips
function addTooltips() {
    const tooltipData = {
        '.stat': 'Key statistic about ticket fraud',
        '.objective': 'Core feature of BlockTicket',
        '.metric': 'Expected impact metric',
        '.feature': 'System feature for trust',
        '.ai-feature': 'AI-powered capability'
    };

    for (const [selector, tooltipText] of Object.entries(tooltipData)) {
        document.querySelectorAll(selector).forEach(element => {
            element.setAttribute('title', tooltipText);
        });
    }
}

// Parallax scroll effect
function addParallaxEffect() {
    const parallaxElements = document.querySelectorAll('section');
    
    window.addEventListener('scroll', () => {
        parallaxElements.forEach(element => {
            const scrollPosition = window.pageYOffset;
            const elementPosition = element.offsetTop;
            const elementHeight = element.offsetHeight;
            
            if (scrollPosition < elementPosition + elementHeight) {
                const parallaxValue = (scrollPosition - elementPosition) * 0.5;
                element.style.backgroundPosition = `0 ${parallaxValue}px`;
            }
        });
    });
}

// Add smooth page transitions
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
    document.body.style.transition = 'opacity 0.5s ease';
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        window.scrollBy({ top: -100, behavior: 'smooth' });
    } else if (e.key === 'ArrowDown') {
        window.scrollBy({ top: 100, behavior: 'smooth' });
    }
});