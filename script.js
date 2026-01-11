(async () => {
    if (typeof tmImage === "undefined") {
        console.error("tmImage is not loaded! Check your script tags.");
        return;
    }

    const URL = "my_model/";

    // Hier kun je jouw classes aan geluiden en afbeeldingen koppelen

    const sounds = {
        "Cirkel": new Audio("my_sounds/Cirkel.mp3"),
        "Vierkant": new Audio("my_sounds/Vierkant.mp3"),
        "Ster": new Audio("my_sounds/Ster.mp3")
    };

    const images = {
        "Cirkel": "my_images/cirkel.svg",
        "Vierkant": "my_images/vierkant.svg",
        "Ster": "my_images/ster.svg",
        "Overlay": "my_images/Transparante ogen.png"
    };

    // order of shapes and class keys (triangle removed)
    const shapeKeys = ["Cirkel", "Vierkant", "Ster"];

    // ---

    let model = null, webcam = null;
    const confidenceThreshold = 0.98; 
    const maxThreshold = 1.0;        
    const holdTime = 2000;            
    const cooldown = 4000;            
    const bufferSize = 5;             
    const displayHoldDuration = 5000; 
    const neutralHoldDuration = 500;  

    const holdStart = {};             
    const lastPlayed = {};
    const predictionBuffer = {};      
    let currentDetectedClass = null;
    let lastDetectionTime = 0;
    let lastNeutralTime = 0;

    const imageDiv = document.getElementById("image-display");

    function renderImages() {
        const overlayPath = images["Overlay"];
        let html = `
            <img class="overlay-img" src="${overlayPath}" alt="overlay">
        `;

        // one overlay per shape so colored SVGs can be shown over the black shapes
        for (const key of shapeKeys) {
            const src = images[key] || '';
            html += `<img class="shape-overlay shape-${key}" src="${src}" data-class="${key}" alt="${key}" />`;
        }

        imageDiv.innerHTML = html;
    }

    function highlightShape(key) {
        const overlays = imageDiv.querySelectorAll('.shape-overlay');
        overlays.forEach(el => {
            const k = el.getAttribute('data-class');
            if (!k) return;
            if (k === key) {
                el.style.opacity = '1';
                el.style.filter = 'none';
            } else {
                el.style.opacity = '0.25';
                el.style.filter = 'grayscale(1) brightness(0.6)';
            }
        });
    }

    function clearHighlights() {
        const overlays = imageDiv.querySelectorAll('.shape-overlay');
        overlays.forEach(el => {
            el.style.opacity = '0.25';
            el.style.filter = 'grayscale(1) brightness(0.6)';
        });
    }

    renderImages();

    try {
        webcam = new tmImage.Webcam(400, 300, true, { facingMode: "user" });
        await webcam.setup();
        await webcam.play();
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        console.log("Webcam ready!");
    } catch (err) {
        console.error("Webcam initialization failed:", err);
        return;
    }

    try {
        model = await tmImage.load(URL + "model.json", URL + "metadata.json");
        console.log("Model loaded!");
    } catch (err) {
        console.error("Model loading failed:", err);
        model = null;
    }

    async function loop() {
        webcam.update();
        if (model) await predict();
        requestAnimationFrame(loop);
    }

    async function predict() {
        try {
            const prediction = await model.predict(webcam.canvas);

            let highest = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
            const className = highest.className;
            const prob = highest.probability;

            if (!predictionBuffer[className]) predictionBuffer[className] = [];
            predictionBuffer[className].push(prob);
            if (predictionBuffer[className].length > bufferSize) predictionBuffer[className].shift();
            const avgProb = predictionBuffer[className].reduce((a, b) => a + b, 0) / predictionBuffer[className].length;

            const now = Date.now();

            if (currentDetectedClass && now - lastDetectionTime < displayHoldDuration) {
                document.getElementById("prediction").innerText = `Detected: ${currentDetectedClass}`;
                return;
            }

            if (avgProb < confidenceThreshold) {
                if (!currentDetectedClass || now - lastNeutralTime > neutralHoldDuration) {
                    document.getElementById("prediction").innerText = "No detection";
                    renderImages();
                    clearHighlights();
                    currentDetectedClass = null;
                    lastNeutralTime = now;
                }
                return;
            }

            document.getElementById("prediction").innerText =
                `Detected: ${className} (${(avgProb*100).toFixed(2)}%)`;

            if (sounds[className] && avgProb >= confidenceThreshold && avgProb <= maxThreshold) {
                if (!holdStart[className]) holdStart[className] = now;

                if (now - holdStart[className] >= holdTime) {
                    if (!lastPlayed[className] || now - lastPlayed[className] > cooldown) {
                        sounds[className].play();
                        lastPlayed[className] = now;

                        // highlight the detected colored overlay (neutral base removed)
                        renderImages();
                        highlightShape(className);
                        currentDetectedClass = className;
                        lastDetectionTime = now;
                    }
                    holdStart[className] = null;
                }
            } else {
                holdStart[className] = null;
            }

        } catch (err) {
            console.error("Prediction failed:", err);
        }
    }

    loop();
})();