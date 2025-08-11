const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const saveButton = document.getElementById('saveButton');
const statusDiv = document.getElementById('status');
const outputDiv = document.getElementById('output');
const commandsLog = document.getElementById('commandsLog');
const voiceConfirmationCheckbox = document.getElementById('voiceConfirmation');
const autoCapitalizeCheckbox = document.getElementById('autoCapitalize');
const autoPunctuationCheckbox = document.getElementById('autoPunctuation');
const pauseDurationInput = document.getElementById('pauseDuration');

let recognition;
let currentTranscript = '';
let isListening = false;
let autoPunctuationTimeout;

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'sr-RS';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
        statusDiv.textContent = 'Slušam...';
        startButton.disabled = true;
        stopButton.disabled = false;
        isListening = true;
    };

    recognition.onend = () => {
        if (isListening) {
            setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Greška pri ponovnom pokretanju:', e);
                }
            }, 100);
        } else {
            statusDiv.textContent = 'Zaustavljeno.';
            startButton.disabled = false;
            stopButton.disabled = true;
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Greška u prepoznavanju govora:', event.error);
        // KLJUČNA IZMENA: Ako je isListening true, uvek se ponovo pokreće prepoznavanje
        // čak i nakon "no-speech" greške, kako ne bi došlo do zaglavljivanja.
        if (isListening) {
             setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Greška pri ponovnom pokretanju:', e);
                }
            }, 100);
        }
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        if (finalTranscript.length > 0) {
            let textToProcess = finalTranscript;
            const commandResult = handleCommand(textToProcess);
            if (commandResult) {
                textToProcess = commandResult.remainingText;
            }
            
            if (textToProcess.length > 0) {
                if (currentTranscript.length > 0 && !currentTranscript.trim().endsWith(' ') && !currentTranscript.trim().endsWith('\n')) {
                    textToProcess = ' ' + textToProcess;
                }
                currentTranscript += capitalizeSentence(textToProcess);
            }
        }
        
        outputDiv.innerHTML = `${currentTranscript}<span style="color:#999;">${interimTranscript}</span>`;
        
        clearTimeout(autoPunctuationTimeout);
        if (autoPunctuationCheckbox.checked) {
            const duration = parseInt(pauseDurationInput.value, 10);
            autoPunctuationTimeout = setTimeout(() => {
                const lastChar = currentTranscript.trim().slice(-1);
                if (currentTranscript.length > 0 && lastChar !== '.' && lastChar !== '?' && lastChar !== '!' && lastChar !== ',') {
                    currentTranscript = currentTranscript.trim() + '. ';
                    outputDiv.innerHTML = currentTranscript;
                }
            }, duration);
        }
    };
    
    function handleCommand(text) {
        const lowerCaseText = text.toLowerCase().trim();
        const commandIndex = lowerCaseText.indexOf('komanda');

        if (commandIndex === -1) {
            return null;
        }
        
        const commandText = lowerCaseText.substring(commandIndex + 'komanda'.length).trim();
        const beforeCommandText = lowerCaseText.substring(0, commandIndex).trim();

        const systemCommands = [
            { phrases: ['zaustavi'], action: () => {
                isListening = false;
                recognition.stop();
                logCommand('Zaustavi snimanje');
            }},
            { phrases: ['koliko je sati'], action: () => {
                const now = new Date();
                const time = now.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
                speak(`Sada je ${time}`);
                logCommand('Provera vremena');
            }},
            { phrases: ['koji datum'], action: () => {
                const now = new Date();
                const date = now.toLocaleDateString('sr-RS', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                speak(`Danas je ${date}`);
                logCommand('Provera datuma');
            }},
            { phrases: ['pročitaj tekst'], action: () => {
                speak(currentTranscript);
                logCommand('Pročitaj tekst');
            }},
            { phrases: ['obriši sve'], action: () => {
                currentTranscript = '';
                outputDiv.innerHTML = '';
                speak('Tekst je obrisan.');
                logCommand('Obriši sve');
            }},
            // IZMENJENO: Dodata fraza 'obriši zadnji' za bolje prepoznavanje
            { phrases: ['obriši zadnje', 'obriši zadnji'], action: () => {
                const words = currentTranscript.trim().split(' ');
                if (words.length > 1) {
                    currentTranscript = words.slice(0, -1).join(' ') + ' ';
                } else {
                    currentTranscript = '';
                }
                outputDiv.innerHTML = currentTranscript;
                speak('Poslednja reč je obrisana.');
                logCommand('Obriši poslednju reč');
            }},
            { phrases: ['obriši poslednju rečenicu'], action: () => {
                const lastPunctuationIndex = Math.max(
                    currentTranscript.lastIndexOf('.'),
                    currentTranscript.lastIndexOf('?'),
                    currentTranscript.lastIndexOf('!')
                );
                
                if (lastPunctuationIndex !== -1) {
                    const tempTranscript = currentTranscript.substring(0, lastPunctuationIndex);
                    const secondLastPunctuationIndex = Math.max(
                        tempTranscript.lastIndexOf('.'),
                        tempTranscript.lastIndexOf('?'),
                        tempTranscript.lastIndexOf('!')
                    );

                    if (secondLastPunctuationIndex !== -1) {
                        currentTranscript = currentTranscript.substring(0, secondLastPunctuationIndex + 1).trim();
                    } else {
                        currentTranscript = '';
                    }
                } else {
                    currentTranscript = '';
                }
                
                outputDiv.innerHTML = currentTranscript;
                speak('Poslednja rečenica je obrisana.');
                logCommand('Obriši poslednju rečenicu');
            }},
            { phrases: ['kopiraj tekst'], action: () => {
                copyTextToClipboard(currentTranscript);
                speak('Tekst je kopiran.');
                logCommand('Kopiraj tekst');
            }}
        ];

        const punctuationCommands = [
            { phrases: ['zarez'], punctuation: ', ' },
            { phrases: ['tačka'], punctuation: '. ' },
            { phrases: ['upitnik'], punctuation: '? ' },
            { phrases: ['uzvičnik'], punctuation: '! ' },
            { phrases: ['novi red'], punctuation: '\n' },
        ];
        
        for (const cmd of systemCommands) {
            for (const phrase of cmd.phrases) {
                const regex = new RegExp(`^${phrase}\\b`, 'i');
                if (regex.test(commandText)) {
                    cmd.action();
                    const remainingText = beforeCommandText + ' ' + commandText.replace(regex, '').trim();
                    return { remainingText: remainingText.trim() };
                }
            }
        }

        for (const puncCmd of punctuationCommands) {
            for (const phrase of puncCmd.phrases) {
                const regex = new RegExp(`^${phrase}\\b`, 'i');
                if (regex.test(commandText)) {
                    logCommand(`Interpunkcija: ${phrase}`);
                    
                    let textAfterCommand = commandText.replace(regex, '').trim();

                    currentTranscript = currentTranscript.trim();
                    if (beforeCommandText.length > 0) {
                        currentTranscript += ' ' + capitalizeSentence(beforeCommandText);
                    }
                    
                    currentTranscript = currentTranscript.trim();
                    currentTranscript += puncCmd.punctuation;
                    
                    if (textAfterCommand.length > 0) {
                         currentTranscript += capitalizeSentence(textAfterCommand);
                    }
                    
                    outputDiv.innerHTML = currentTranscript;
                    return { remainingText: '' };
                }
            }
        }
        
        return null;
    }
    
    // IZMENJENO: Logika za kapitalizaciju je sada stroža
    function capitalizeSentence(text) {
        if (!autoCapitalizeCheckbox.checked) {
            return text;
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) return '';
        
        const trimmedCurrentTranscript = currentTranscript.trim();
        const lastChar = trimmedCurrentTranscript.slice(-1);

        if (trimmedCurrentTranscript.length === 0 || lastChar === '.' || lastChar === '?' || lastChar === '!') {
            const firstLetterIndex = trimmedText.search(/[a-zA-Z]/);
            if (firstLetterIndex !== -1) {
                return trimmedText.slice(0, firstLetterIndex) + trimmedText.charAt(firstLetterIndex).toUpperCase() + trimmedText.slice(firstLetterIndex + 1);
            }
        }
        
        return text;
    }
    
    function speak(text) {
        if (voiceConfirmationCheckbox.checked && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'sr-RS';
            utterance.voice = window.speechSynthesis.getVoices().find(voice => voice.lang === 'sr-RS');
            window.speechSynthesis.speak(utterance);
        }
    }

    function logCommand(commandName) {
        commandsLog.innerHTML += `<p>${new Date().toLocaleTimeString()} - Izvršena komanda: <strong>${commandName}</strong></p>`;
        commandsLog.scrollTop = commandsLog.scrollHeight;
    }

    function copyTextToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Greška pri kopiranju teksta:', err);
            });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Greška pri kopiranju teksta:', err);
            }
            document.body.removeChild(textArea);
        }
    }

    startButton.onclick = () => {
        if (!isListening) {
            isListening = true;
            currentTranscript = '';
            outputDiv.innerHTML = '';
            commandsLog.innerHTML = '';
            recognition.start();
        }
    };
    stopButton.onclick = () => {
        isListening = false;
        recognition.stop();
    };
    saveButton.onclick = () => {
        copyTextToClipboard(currentTranscript);
        speak('Tekst je kopiran.');
        logCommand('Kopiraj tekst');
    };

} else {
    statusDiv.textContent = 'Nažalost, Web Speech API nije podržan u ovom pregledaču.';
    startButton.disabled = true;
    stopButton.disabled = true;
    saveButton.disabled = true;
}