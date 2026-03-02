document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('soundboard-grid');
    const stopAllBtn = document.getElementById('stop-all-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const overlapCheckbox = document.getElementById('overlap-checkbox');
    const tabBtns = document.querySelectorAll('.tab-btn');

    // Store all files and active category
    let allFiles = {};
    let activeCategory = 'chao';
    let activeAudios = [];
    let currentVolume = parseFloat(volumeSlider.value);

    // Fetch the list of audio files
    fetch('files.json')
        .then(response => {
            if (!response.ok) throw new Error('Could not load files.json');
            return response.json();
        })
        .then(files => {
            allFiles = files;
            renderCategory(activeCategory);
        })
        .catch(error => {
            console.error('Error fetching files:', error);
            gridContainer.innerHTML = `
                <div class="loading-state" style="color: #f5576c;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <p>Failed to load files list. Make sure you've run the node script first.</p>
                </div>
            `;
        });

    // Tab switching logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            if (category === activeCategory) return;

            // Update UI
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            activeCategory = category;
            renderCategory(activeCategory);
        });
    });

    function renderCategory(category) {
        const files = allFiles[category] || [];

        if (files.length === 0) {
            gridContainer.innerHTML = `<div class="loading-state"><p>No audio files found for ${category}.</p></div>`;
            return;
        }

        // Clear and render
        gridContainer.innerHTML = '';
        files.forEach((file, index) => {
            const btn = createSoundButton(file, index, category);
            gridContainer.appendChild(btn);
        });
    }

    // Event listeners for controls
    stopAllBtn.addEventListener('click', stopAllSounds);

    volumeSlider.addEventListener('input', (e) => {
        currentVolume = parseFloat(e.target.value);
        activeAudios.forEach(obj => {
            obj.audio.volume = currentVolume;
        });
    });

    function createSoundButton(fileName, index, category) {
        const nameParts = fileName.split('.');
        const ext = nameParts.pop();
        const displayName = nameParts.join('.');

        const btn = document.createElement('button');
        btn.className = 'sound-btn';
        btn.style.animationDelay = `${(index * 0.03) % 0.5}s`;
        btn.style.animation = 'fadeInUp 0.6s ease-out forwards';

        const iconSvg = `
            <svg class="audio-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
        `;

        btn.innerHTML = `
            ${iconSvg}
            <span class="btn-label">${displayName}</span>
            <span class="btn-ext">.${ext}</span>
        `;

        btn.addEventListener('click', () => {
            playSound(fileName, btn, category);
        });

        return btn;
    }

    function playSound(fileName, buttonElement, category) {
        if (!overlapCheckbox.checked) {
            stopAllSounds();
        }

        // Map category to folder path for local playback
        const folderMap = {
            'chao': 'Chao Voices',
            'sonic': 'Sonic',
            'shadow': 'Shadow',
            'pokemon': 'Pokemon'
        };
        const folderName = folderMap[category] || 'Chao Voices';

        const audioPath = `${folderName}/${fileName}`;
        const audio = new Audio(audioPath);
        audio.volume = currentVolume;

        buttonElement.classList.add('playing');
        const audioObj = { audio, buttonElement };
        activeAudios.push(audioObj);

        // Send request to Discord Bot server
        fetch('/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: fileName, folder: category })
        })
            .then(async response => {
                if (!response.ok) {
                    const data = await response.json();
                    console.error('Bot Error:', data.error);
                    if (response.status === 400) {
                        alert('Bot Error: ' + data.error);
                    }
                }
            })
            .catch(err => console.log('Bot server not reachable/configured yet.'));

        audio.play().catch(err => {
            console.error('Error playing sound:', err);
            buttonElement.classList.remove('playing');
        });

        audio.onended = () => {
            buttonElement.classList.remove('playing');
            activeAudios = activeAudios.filter(obj => obj.audio !== audio);
        };
    }

    function stopAllSounds() {
        activeAudios.forEach(obj => {
            obj.audio.pause();
            obj.audio.currentTime = 0;
            if (obj.buttonElement) {
                obj.buttonElement.classList.remove('playing');
            }
        });
        activeAudios = [];

        fetch('/stop', {
            method: 'POST'
        }).catch(err => { });
    }
});
