// Physics Ball Simulator - Multi-Ball Edition with Replay
// Using Three.js for 3D rendering and Cannon.js for physics

// Global variables
let scene, camera, renderer, world;
let balls = [];
let groundMesh, groundBody;
let platformMesh, platformBody;
let isDropping = false;
let isPaused = false;
let isReplaying = false;
let startTime = 0;
let animationId = null;
let replaySpeed = 1.0;
let trajectoryData = [];
let replayIndex = 0;

// Camera tracking
let cameraTargetY = 25;
let cameraTargetZ = 45;
const cameraLerpFactor = 0.05;

// Ball properties database
const ballProperties = {
    tennis: { mass: 0.058, radius: 0.033, bounciness: 0.70, drag: 0.0003, color: 0xCCFF00, name: 'Tennis Ball' },
    basketball: { mass: 0.62, radius: 0.12, bounciness: 0.75, drag: 0.0005, color: 0xFF6600, name: 'Basketball' },
    soccer: { mass: 0.43, radius: 0.11, bounciness: 0.65, drag: 0.0004, color: 0xFFFFFF, name: 'Soccer Ball' },
    baseball: { mass: 0.145, radius: 0.037, bounciness: 0.55, drag: 0.0003, color: 0xFFFFFF, name: 'Baseball' },
    cricket: { mass: 0.163, radius: 0.036, bounciness: 0.50, drag: 0.0003, color: 0xDC143C, name: 'Cricket Ball' },
    volleyball: { mass: 0.27, radius: 0.11, bounciness: 0.70, drag: 0.0004, color: 0xFFD700, name: 'Volleyball' },
    golf: { mass: 0.046, radius: 0.021, bounciness: 0.80, drag: 0.0002, color: 0xFFFFFF, name: 'Golf Ball' },
    bowling: { mass: 7.0, radius: 0.11, bounciness: 0.25, drag: 0.0006, color: 0x000080, name: 'Bowling Ball' },
    football: { mass: 0.40, radius: 0.14, bounciness: 0.60, drag: 0.0005, color: 0x8B4513, name: 'Football' },
    rubber: { mass: 0.1, radius: 0.05, bounciness: 0.85, drag: 0.0004, color: 0xFF0000, name: 'Rubber Ball' },
    steel: { mass: 3.5, radius: 0.05, bounciness: 0.35, drag: 0.0001, color: 0x808080, name: 'Steel Ball' }
};

// Ball class
class Ball {
    constructor(type, height, xOffset) {
        this.type = type;
        this.props = ballProperties[type];
        this.height = height;
        this.xOffset = xOffset;
        this.mesh = null;
        this.body = null;
        this.trailPoints = [];
        this.maxHeight = height;
        this.bounceCount = 0;
        this.totalDistance = 0;
        this.lastY = height + this.props.radius;
        this.impactVelocity = 0;
        this.hasLanded = false;
        this.firstBounceHeight = 0;
        this.landedTime = 0;
        this.framesNearGround = 0;
        this.dropTime = Date.now();
    }
}

// Initialize the scene
function init() {
    console.log('Initializing Physics Ball Simulator...');
    
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    console.log('Container size:', width, 'x', height);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
    camera.position.set(0, 25, 45);
    camera.lookAt(0, 10, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    world = new CANNON.World();
    world.gravity.set(0, -9.81, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    createGround();
    createPlatform(30);
    setupEventListeners();
    updateBallInfo();

    console.log('Initialization complete!');
    animate();
}

function createGround() {
    const groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const gridHelper = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

function createPlatform(height) {
    if (platformBody) world.removeBody(platformBody);
    if (platformMesh) scene.remove(platformMesh);

    const platformShape = new CANNON.Box(new CANNON.Vec3(6, 0.5, 6));
    platformBody = new CANNON.Body({ mass: 0 });
    platformBody.addShape(platformShape);
    platformBody.position.set(0, height, 0);
    world.addBody(platformBody);

    const platformGeometry = new THREE.BoxGeometry(12, 1, 12);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
    platformMesh.position.set(0, height, 0);
    platformMesh.castShadow = true;
    platformMesh.receiveShadow = true;
    scene.add(platformMesh);
}

function createBall(ball) {
    const props = ball.props;
    const xPos = ball.xOffset;

    const ballShape = new CANNON.Sphere(props.radius);
    ball.body = new CANNON.Body({ 
        mass: props.mass,
        linearDamping: props.drag,
        angularDamping: 0.1
    });
    ball.body.addShape(ballShape);
    ball.body.position.set(xPos, ball.height + props.radius, 0);
    ball.body.bounciness = props.bounciness;
    ball.body.friction = 0.3;
    world.addBody(ball.body);

    const ballGeometry = new THREE.SphereGeometry(props.radius, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ 
        color: props.color,
        roughness: 0.4,
        metalness: ball.type === 'steel' ? 0.9 : 0.1
    });
    ball.mesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.mesh.position.copy(ball.body.position);
    ball.mesh.castShadow = true;
    scene.add(ball.mesh);

    console.log(`Created ${props.name} at (${xPos}, ${ball.height + props.radius})`);
}

function clearAllBalls() {
    balls.forEach(ball => {
        if (ball.body) {
            world.removeBody(ball.body);
            ball.body = null;
        }
        if (ball.mesh) {
            scene.remove(ball.mesh);
            ball.mesh = null;
        }
        ball.trailPoints.forEach(point => scene.remove(point));
        ball.trailPoints = [];
    });
    balls = [];
    cameraTargetY = 25;
    cameraTargetZ = 45;
}

function addTrailPoint(ball) {
    if (!document.getElementById('show-trail').checked) return;
    
    const geometry = new THREE.SphereGeometry(0.12, 6, 6);
    const material = new THREE.MeshBasicMaterial({ 
        color: ball.props.color, 
        transparent: true, 
        opacity: 0.5 
    });
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(ball.body.position);
    scene.add(point);
    ball.trailPoints.push(point);

    if (ball.trailPoints.length > 60) {
        const oldPoint = ball.trailPoints.shift();
        scene.remove(oldPoint);
    }
}

function getAirDensity(temp, humidity, pressure) {
    const tempK = temp + 273.15;
    const vaporPressure = humidity / 100 * 6.112 * Math.exp((17.67 * temp) / (temp + 243.5));
    const dryPressure = pressure * 100 - vaporPressure;
    return (dryPressure / (287.05 * tempK)) + (vaporPressure / (461.5 * tempK));
}

function applyWeatherForces() {
    if (!isDropping && !isReplaying) return;

    const temp = parseFloat(document.getElementById('temperature').value);
    const windSpeed = parseFloat(document.getElementById('wind-speed').value);
    const windDir = parseFloat(document.getElementById('wind-direction').value) * Math.PI / 180;
    const humidity = parseFloat(document.getElementById('humidity').value);
    const pressure = parseFloat(document.getElementById('pressure').value);

    balls.forEach(ball => {
        if (!ball.body || ball.hasLanded) return;

        if (document.getElementById('air-resistance').checked) {
            const airDensity = getAirDensity(temp, humidity, pressure);
            const velocity = ball.body.velocity;
            const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
            
            if (speed > 0.01) {
                const dragCoeff = ball.props.drag;
                const dragForce = -0.5 * airDensity * dragCoeff * speed * velocity;
                ball.body.applyForce(new CANNON.Vec3(dragForce.x, dragForce.y, dragForce.z), ball.body.position);
            }
        }

        if (windSpeed > 0) {
            const windForceX = Math.sin(windDir) * windSpeed * 0.05;
            const windForceZ = Math.cos(windDir) * windSpeed * 0.05;
            ball.body.applyForce(new CANNON.Vec3(windForceX, 0, windForceZ), ball.body.position);
        }
    });
}

function allBallsLanded() {
    if (balls.length === 0) return false;
    return balls.every(ball => ball.hasLanded);
}

function recordTrajectory() {
    const frame = balls.map(ball => ({
        type: ball.type,
        position: { x: ball.body.position.x, y: ball.body.position.y, z: ball.body.position.z },
        quaternion: { x: ball.body.quaternion.x, y: ball.body.quaternion.y, z: ball.body.quaternion.z, w: ball.body.quaternion.w },
        hasLanded: ball.hasLanded
    }));
    trajectoryData.push(frame);
}

// Update camera to follow falling balls
function updateCamera() {
    if (!isDropping || balls.length === 0) return;
    
    let lowestY = Infinity;
    let highestY = -Infinity;
    let centerX = 0;
    
    balls.forEach(ball => {
        if (ball.body && !ball.hasLanded) {
            const y = ball.body.position.y;
            if (y < lowestY) lowestY = y;
            if (y > highestY) highestY = y;
            centerX += ball.body.position.x;
        }
    });
    
    centerX = balls.length > 0 ? centerX / balls.length : 0;
    
    const spread = highestY - lowestY;
    const margin = Math.max(10, spread * 1.5);
    const targetCenterY = (lowestY + highestY) / 2 + margin * 0.3;
    cameraTargetY = Math.max(targetCenterY, 15);
    
    cameraTargetZ = 45 + spread * 0.5;
    cameraTargetZ = Math.min(Math.max(cameraTargetZ, 30), 80);
    
    camera.position.y += (cameraTargetY - camera.position.y) * cameraLerpFactor;
    camera.position.z += (cameraTargetZ - camera.position.z) * cameraLerpFactor;
    camera.position.x += (centerX - camera.position.x) * cameraLerpFactor;
    
    const lookAtY = Math.max(lowestY - 5, 0);
    camera.lookAt(centerX, lookAtY, 0);
}

function updateStats() {
    const allLanded = allBallsLanded();
    const currentTime = Date.now();
    
    balls.forEach(ball => {
        if (!ball.body || ball.hasLanded) return;

        const currentY = ball.body.position.y;
        const radius = ball.props.radius;
        const velocity = ball.body.velocity;
        const timeSinceDrop = (currentTime - ball.dropTime) / 1000;

        // Track max height
        if (currentY > ball.maxHeight) {
            ball.maxHeight = currentY;
        }

        // Track distance
        ball.totalDistance += Math.abs(currentY - ball.lastY);
        ball.lastY = currentY;

        // Detect bounces
        if (currentY <= radius + 0.15 && Math.abs(velocity.y) > 0.8) {
            ball.bounceCount++;
            if (ball.bounceCount === 1) {
                ball.firstBounceHeight = ball.maxHeight;
            }
        }

        // Track impact velocity
        if (currentY <= radius + 1) {
            ball.impactVelocity = Math.abs(velocity.y);
        }

        // Robust landing detection with multiple conditions
        const isNearGround = currentY <= radius + 0.3;
        const isVerticalSlow = Math.abs(velocity.y) < 1.5;
        const isHorizontalSlow = Math.abs(velocity.x) < 1.0 && Math.abs(velocity.z) < 1.0;
        const totalSpeed = Math.sqrt(velocity.x**2 + velocity.y**2 + velocity.z**2);
        const isOverallSlow = totalSpeed < 1.5;
        
        // Count frames near ground with low velocity
        if (isNearGround && isVerticalSlow && isHorizontalSlow && isOverallSlow) {
            ball.framesNearGround++;
        } else {
            ball.framesNearGround = 0;
        }
        
        // Land ball if:
        // 1. Near ground for 6+ frames (~0.1s), OR
        // 2. Near ground for 3+ frames AND very slow, OR  
        // 3. Time limit exceeded (ball has been falling for max expected time)
        const maxFallTime = (ball.height / 4.4) + 2; // sqrt(2h/g) + buffer
        const isTimeLimitExceeded = timeSinceDrop > maxFallTime;
        const isVerySlow = totalSpeed < 0.5 && ball.framesNearGround >= 3;
        
        if ((ball.framesNearGround >= 6 || isVerySlow || isTimeLimitExceeded) && !ball.hasLanded) {
            ball.hasLanded = true;
            ball.landedTime = currentTime;
            // Snap to ground and zero all velocities
            ball.body.position.y = radius;
            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            console.log(`${ball.props.name} landed! Frames: ${ball.framesNearGround}, Time: ${timeSinceDrop.toFixed(2)}s`);
        }
    });

    // Stop simulation when all balls have landed
    if (allLanded && isDropping) {
        isDropping = false;
        console.log('All balls landed - simulation stopped');
        document.getElementById('replay-btn').disabled = false;
    }

    renderStats();
    renderComparison();
}

function renderStats() {
    const statsContent = document.getElementById('stats-content');
    if (balls.length === 0) {
        statsContent.innerHTML = '<p class="hint">Drop balls to see statistics</p>';
        return;
    }

    let html = '';
    const fallTime = balls.some(b => !b.hasLanded) 
        ? ((Date.now() - startTime) / 1000).toFixed(2) 
        : (((balls[0].landedTime || Date.now()) - startTime) / 1000).toFixed(2);

    balls.forEach((ball) => {
        const color = '#' + ball.props.color.toString(16).padStart(6, '0');
        const ballFallTime = ball.hasLanded 
            ? ((ball.landedTime - ball.dropTime) / 1000).toFixed(2)
            : fallTime;
        
        html += `
            <div class="stat-ball" style="border-left-color: ${color}">
                <h4 style="color: ${color}">${ball.props.name}</h4>
                <div class="stat-row"><span>Fall Time:</span><span>${ballFallTime} s</span></div>
                <div class="stat-row"><span>Max Height:</span><span>${ball.maxHeight.toFixed(2)} m</span></div>
                <div class="stat-row"><span>Bounces:</span><span>${ball.bounceCount}</span></div>
                <div class="stat-row"><span>Impact Velocity:</span><span>${ball.impactVelocity.toFixed(2)} m/s</span></div>
                <div class="stat-row"><span>Distance:</span><span>${ball.totalDistance.toFixed(2)} m</span></div>
            </div>
        `;
    });

    statsContent.innerHTML = html;
}

function renderComparison() {
    const comparisonContent = document.getElementById('comparison-content');
    if (balls.length < 2) {
        comparisonContent.innerHTML = '<p class="hint">Select multiple balls to compare</p>';
        return;
    }

    let highestBounce = { ball: null, value: 0 };
    let mostBounces = { ball: null, value: 0 };

    balls.forEach(ball => {
        if (ball.firstBounceHeight > highestBounce.value) {
            highestBounce = { ball, value: ball.firstBounceHeight };
        }
        if (ball.bounceCount > mostBounces.value) {
            mostBounces = { ball, value: ball.bounceCount };
        }
    });

    let html = '<table class="comparison-table"><thead><tr>';
    html += '<th>Ball</th><th>1st Bounce</th><th>Bounces</th><th>Status</th>';
    html += '</tr></thead><tbody>';

    balls.forEach(ball => {
        const isWinner = ball === highestBounce.ball || ball === mostBounces.ball;
        const status = ball.hasLanded ? '✅ Landed' : '⏳ Falling';
        html += `<tr class="${isWinner ? 'winner' : ''}">`;
        html += `<td>${ball.props.name}</td>`;
        html += `<td>${ball.firstBounceHeight > 0 ? ball.firstBounceHeight.toFixed(2) + ' m' : '-'}</td>`;
        html += `<td>${ball.bounceCount}</td>`;
        html += `<td>${status}${isWinner ? ' <span class="winner-badge">🏆</span>' : ''}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    
    if (highestBounce.ball) {
        html += `<p style="margin-top:10px;color:#FFD700">🏆 Highest Bounce: ${highestBounce.ball.props.name} (${highestBounce.value.toFixed(2)}m)</p>`;
    }

    comparisonContent.innerHTML = html;
}

function animate() {
    animationId = requestAnimationFrame(animate);

    if (isReplaying && trajectoryData.length > 0) {
        const replayFrame = trajectoryData[Math.min(Math.floor(replayIndex), trajectoryData.length - 1)];
        if (replayFrame) {
            replayFrame.forEach((frameData, idx) => {
                if (balls[idx] && balls[idx].mesh) {
                    balls[idx].mesh.position.set(frameData.position.x, frameData.position.y, frameData.position.z);
                    balls[idx].mesh.quaternion.set(frameData.quaternion.x, frameData.quaternion.y, frameData.quaternion.z, frameData.quaternion.w);
                }
            });
        }
        replayIndex += replaySpeed;
        if (replayIndex >= trajectoryData.length) {
            isReplaying = false;
            replayIndex = 0;
            document.getElementById('replay-btn').textContent = '🎬 Replay (' + replaySpeed + 'x)';
            document.getElementById('replay-btn').disabled = false;
        }
    } else if (!isPaused && isDropping) {
        world.step(1 / 60);
        applyWeatherForces();

        balls.forEach(ball => {
            if (ball.mesh && ball.body && !ball.hasLanded) {
                ball.mesh.position.copy(ball.body.position);
                ball.mesh.quaternion.copy(ball.body.quaternion);
                recordTrajectory();
                if (balls.length % 5 === 0) {
                    addTrailPoint(ball);
                }
            }
        });

        updateCamera();
        updateStats();
    }

    renderer.render(scene, camera);
}

function setupEventListeners() {
    console.log('Setting up event listeners...');

    document.getElementById('ball-type').addEventListener('change', updateBallInfo);

    document.getElementById('height-type').addEventListener('change', (e) => {
        const customInput = document.getElementById('custom-height');
        customInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    ['temperature', 'wind-speed', 'wind-direction', 'humidity', 'pressure'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => {
                let valueId = id + '-value';
                if (id === 'wind-speed') valueId = 'wind-value';
                if (id === 'wind-direction') valueId = 'wind-dir-value';
                const valueElement = document.getElementById(valueId);
                if (valueElement) valueElement.textContent = e.target.value;
            });
        }
    });

    const speedSlider = document.getElementById('replay-speed');
    const speedValue = document.getElementById('speed-value');
    speedSlider.addEventListener('input', (e) => {
        replaySpeed = parseFloat(e.target.value);
        speedValue.textContent = replaySpeed.toFixed(1);
        document.getElementById('replay-btn').textContent = '🎬 Replay (' + replaySpeed + 'x)';
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === replaySpeed);
        });
    });

    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const speed = parseFloat(btn.dataset.speed);
            replaySpeed = speed;
            speedSlider.value = speed;
            speedValue.textContent = speed.toFixed(1);
            document.getElementById('replay-btn').textContent = '🎬 Replay (' + speed + 'x)';
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const dropBtn = document.getElementById('drop-btn');
    console.log('Drop button found:', dropBtn !== null);
    if (dropBtn) {
        dropBtn.addEventListener('click', dropBalls);
    }

    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', startReplay);
    }

    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    window.addEventListener('resize', onWindowResize);

    console.log('Event listeners setup complete!');
}

function startReplay() {
    if (trajectoryData.length === 0 || balls.length === 0) return;
    
    isReplaying = true;
    isDropping = false;
    isPaused = false;
    replayIndex = 0;
    document.getElementById('replay-btn').disabled = true;
    document.getElementById('replay-btn').textContent = '🎬 Playing...';
    console.log('Starting replay at', replaySpeed, 'x speed');
}

function updateBallInfo() {
    const select = document.getElementById('ball-type');
    const selectedOptions = Array.from(select.selectedOptions);
    const infoBox = document.getElementById('ball-info');

    if (selectedOptions.length === 0) {
        infoBox.innerHTML = '<p class="hint">Select one or more balls to drop</p>';
        return;
    }

    if (selectedOptions.length === 1) {
        const props = ballProperties[selectedOptions[0].value];
        infoBox.innerHTML = `<strong>${props.name}</strong><br>Mass: ${props.mass} kg | Radius: ${props.radius} m<br>Bounciness: ${props.bounciness}`;
    } else {
        infoBox.innerHTML = `<strong>${selectedOptions.length} balls selected</strong><br>Hold Ctrl/Cmd to select more`;
    }
}

function getCurrentHeight() {
    const heightType = document.getElementById('height-type').value;
    if (heightType === 'custom') {
        return parseFloat(document.getElementById('custom-height').value) || 10;
    }
    return parseFloat(heightType);
}

function dropBalls() {
    console.log('dropBalls() called, isDropping:', isDropping);
    
    if (isDropping || isReplaying) {
        console.log('Already dropping or replaying, returning');
        return;
    }

    const select = document.getElementById('ball-type');
    const selectedOptions = Array.from(select.selectedOptions);

    if (selectedOptions.length === 0) {
        alert('Please select at least one ball!');
        return;
    }

    const height = getCurrentHeight();
    console.log('Dropping', selectedOptions.length, 'balls from', height, 'm');

    clearAllBalls();
    trajectoryData = [];
    
    const totalBalls = selectedOptions.length;
    const spacing = Math.min(1.5, 8 / totalBalls);
    const startX = -((totalBalls - 1) * spacing) / 2;

    selectedOptions.forEach((option, index) => {
        const xOffset = startX + (index * spacing);
        const ball = new Ball(option.value, height, xOffset);
        balls.push(ball);
        createBall(ball);
    });

    startTime = Date.now();
    isDropping = true;
    cameraTargetY = height / 2 + 10;
    cameraTargetZ = 45 + height * 0.1;
    camera.position.set(0, cameraTargetY, cameraTargetZ);
    camera.lookAt(0, height / 2, 0);
    document.getElementById('replay-btn').disabled = true;
    console.log('Ball drop started!', balls.length, 'balls');
}

function resetSimulation() {
    isDropping = false;
    isReplaying = false;
    isPaused = false;
    document.getElementById('pause-btn').textContent = '⏸️ Pause';
    document.getElementById('replay-btn').disabled = true;
    document.getElementById('replay-btn').textContent = '🎬 Replay (1x)';

    clearAllBalls();
    trajectoryData = [];
    replayIndex = 0;

    document.getElementById('stats-content').innerHTML = '<p class="hint">Drop balls to see statistics</p>';
    document.getElementById('comparison-content').innerHTML = '<p class="hint">Select multiple balls to compare</p>';

    console.log('Simulation reset!');
}

function togglePause() {
    if (isReplaying) return;
    isPaused = !isPaused;
    document.getElementById('pause-btn').textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
    console.log('Pause toggled:', isPaused);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

window.addEventListener('load', init);
