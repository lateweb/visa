// template/js/quiz-sidebar.js
/**
 * quiz-sidebar.js
 * Generates and manages the left sidebar navigation and the examination timer logic.
 */
(() => {
    let timerInterval = null;
    const PAGE_LOAD_TIME = new Date();

    window.QuizSidebar = {
        markAnswered: (qBlock) => {
            const id = qBlock.id;
            if (!id) return;
            const link = document.querySelector(`.quiz-nav-item a[href="#${id}"]`);
            if (link) {
                link.classList.remove('q-correct', 'q-incorrect');
                link.classList.add('answered');
            }
        },
        markGraded: (qBlock, isCorrect) => {
            const id = qBlock.id;
            if (!id) return;
            const link = document.querySelector(`.quiz-nav-item a[href="#${id}"]`);
            if (!link) return;
            link.classList.remove('answered', 'q-correct', 'q-incorrect');
            link.classList.add(isCorrect ? 'q-correct' : 'q-incorrect');
        },
        markUnanswered: (qBlock) => {
            const id = qBlock.id;
            if (!id) return;
            const link = document.querySelector(`.quiz-nav-item a[href="#${id}"]`);
            if (link) link.classList.remove('answered');
        },
        stopTimer: () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }
    };

    function buildTimer(sidebar) {
        const lang = typeof quizLang !== 'undefined' ? quizLang : 'en';
        const labels = (lang === 'fi') ? { time: "Aika", started: "Aloitettu klo" } : { time: "Time", started: "Started at" };
        
        const timerContainer = document.createElement('div');
        timerContainer.className = 'quiz-timer-container';
        
        const timerValue = document.createElement('div');
        timerValue.className = 'quiz-timer-value';
        timerValue.textContent = "00:00:00";
        
        const timerLabel = document.createElement('div');
        timerLabel.className = 'quiz-timer-label';
        timerLabel.textContent = labels.time;
        
        const startLabel = document.createElement('div');
        startLabel.className = 'quiz-timer-start-time';
        startLabel.textContent = `${labels.started} ${PAGE_LOAD_TIME.getHours().toString().padStart(2, '0')}:${PAGE_LOAD_TIME.getMinutes().toString().padStart(2, '0')}`;
        
        timerContainer.appendChild(timerValue);
        timerContainer.appendChild(timerLabel);
        timerContainer.appendChild(startLabel);
        
        const h3 = sidebar.querySelector('h3');
        if (h3) h3.insertAdjacentElement('afterend', timerContainer);
        else sidebar.prepend(timerContainer);
        
        const startTime = PAGE_LOAD_TIME.getTime();
        timerInterval = setInterval(() => {
            const diff = Math.floor((Date.now() - startTime) / 1000);
            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            timerValue.textContent = `${h}:${m}:${s}`;
        }, 1000);
    }

    function buildSidebar() {
        const sidebar = document.createElement('nav');
        sidebar.className = 'quiz-nav-sidebar';
        sidebar.innerHTML = '<h3>Questions</h3><ul class="quiz-nav-list"></ul>';
        const list = sidebar.querySelector('ul');
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'nav-toggle-btn';
        toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
        toggleBtn.setAttribute('aria-label', 'Toggle Navigation');
        
        buildTimer(sidebar);
        
        const questions = document.querySelectorAll('.question-block');
        questions.forEach((q, index) => {
            if (!q.id) q.id = `question-${index + 1}`;
            const numEl = q.querySelector('.question-number');
            const numberStr = numEl ? numEl.innerText.trim() : `${index + 1}`;
            
            const li = document.createElement('li');
            li.className = 'quiz-nav-item';
            
            const a = document.createElement('a');
            a.href = `#${q.id}`;
            a.textContent = numberStr;
            
            li.appendChild(a);
            list.appendChild(li);
        });
        
        document.body.appendChild(sidebar);
        document.body.appendChild(toggleBtn);
        
        if (window.innerWidth >= 768) sidebar.classList.add('open');
        toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    list.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                    const activeLink = list.querySelector(`a[href="#${entry.target.id}"]`);
                    if (activeLink) activeLink.classList.add('active');
                }
            });
        }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
        questions.forEach(q => observer.observe(q));
        
        if (typeof examMode !== 'undefined' && examMode) {
            const sidebarFinishContainer = document.createElement('div');
            sidebarFinishContainer.className = 'sidebar-finish-container';
            const sidebarFinishBtn = document.createElement('button');
            sidebarFinishBtn.className = 'sidebar-finish-btn';
            sidebarFinishBtn.textContent = (typeof quizLang !== 'undefined' && quizLang === 'fi') ? 'Palauta' : 'Finish Quiz';
            sidebarFinishContainer.appendChild(sidebarFinishBtn);
            sidebar.appendChild(sidebarFinishContainer);
            sidebarFinishBtn.addEventListener('click', () => {
                const mainFinish = document.querySelector('.finish-quiz-btn');
                if (mainFinish) mainFinish.click();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', buildSidebar);
})();
