document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('soundboard-grid');
    const stopAllBtn = document.getElementById('stop-all-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const overlapCheckbox = document.getElementById('overlap-checkbox');

    // Store active audio instances
    let activeAudios = [];

    // Global volume
    let currentVolume = parseFloat(volumeSlider.value);

    // Fetch the list of audio files
    fetch('files.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Could not load files.json');
            }
            return response.json();
        })
        .then(files => {
            if (files.length === 0) {
                gridContainer.innerHTML = '<div class="loading-state"><p>No audio files found in Chao Voices directory.</p></div>';
                return;
            }

            // Clear loading state
            gridContainer.innerHTML = '';

            // Create a button for each file
            files.forEach((file, index) => {
                const btn = createSoundButton(file, index);
                gridContainer.appendChild(btn);
            });
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

    // Event listeners for controls
    stopAllBtn.addEventListener('click', stopAllSounds);

    volumeSlider.addEventListener('input', (e) => {
        currentVolume = parseFloat(e.target.value);
        // Update all currently playing audios
        activeAudios.forEach(obj => {
            obj.audio.volume = currentVolume;
        });
    });

    function createSoundButton(fileName, index) {
        // Parse filename
        const nameParts = fileName.split('.');
        const ext = nameParts.pop();
        let displayName = nameParts.join('.');

        // Optional: Clean up names (e.g. replace underscores with spaces)
        // displayName = displayName.replace(/_/g, ' ');

        const btn = document.createElement('button');
        btn.className = 'sound-btn';
        btn.style.animationDelay = `${(index * 0.03) % 0.5}s`;
        btn.style.animation = 'fadeInUp 0.6s ease-out forwards';

        // Icon SVG
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
            playSound(fileName, btn);
        });

        return btn;
    }

    function playSound(fileName, buttonElement) {
        if (!overlapCheckbox.checked) {
            stopAllSounds();
        }

        const audioPath = `Chao Voices/${fileName}`;
        const audio = new Audio(audioPath);
        audio.volume = currentVolume;

        // Add playing styling
        buttonElement.classList.add('playing');

        // Track the audio instance
        const audioObj = { audio, buttonElement };
        activeAudios.push(audioObj);

        // Send request to Discord Bot server (fire and forget)
        fetch('/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: fileName })
        }).catch(err => console.log('Bot server not reachable/configured yet.'));

        // Play and handle completion
        audio.play().catch(err => {
            console.error('Error playing sound:', err);
            buttonElement.classList.remove('playing');
        });

        audio.onended = () => {
            buttonElement.classList.remove('playing');
            // Remove from active list
            activeAudios = activeAudios.filter(obj => obj.audio !== audio);
        };
    }

    function stopAllSounds() {
        activeAudios.forEach(obj => {
            obj.audio.pause();
            obj.audio.currentTime = 0; // reset
            if (obj.buttonElement) {
                obj.buttonElement.classList.remove('playing');
            }
        });
        activeAudios = [];

        // Tell bot to stop
        fetch('/stop', {
            method: 'POST'
        }).catch(err => { });
    }
});
