// Physics Ball Simulator - Game Logic
// Using Three.js for 3D rendering and Cannon.js for physics

// Global variables
let scene, camera, renderer, world;
let ballMesh, ballBody;
let groundMesh, groundBody;
let platformMesh, platformBody;
let trailPoints = [];
let isDropping = false;
let isPaused = false;
let startTime = 0;
let maxHeight = 0;
let bounceCount = 0;
let totalDistance = 0;
let lastY = 0;
let initialHeight = 0;
let animationId = null;
let impactVelocityRecorded = 0;

// Ball properties database
const ballProperties = {
    tennis: { mass: 0.058, radius: 0.033, bounciness: 0.7, drag: 0.0003, color: 0xCCFF00, name: 'Tennis Ball' },
    basketball: { mass: 0.62, radius: 0.12, bounciness: 0.75, drag: 0.0005, color: 0xFF6600, name: 'Basketball' },
    soccer: { mass: 0.43, radius: 0.11, bounciness: 0.65, drag: 0.0004, color: 0xFFFFFF, name: 'Soccer Ball' },
    bowling: { mass: 7.0, radius: 0.11, bounciness: 0.25, drag: 0.0006, color: 0x000080, name: 'Bowling Ball' },
    golf: { mass: 0.046, radius: 0.021, bounciness: 0.8, drag: 0.0002, color: 0xFFFFFF, name: 'Golf Ball' },
    rubber: { mass: 0.1, radius: 0.05, bounciness: 0.85, drag: 0.0004, color: 0xFF0000, name: 'Rubber Ball' },
    steel: { mass: 3.5, radius: 0.05, bounciness: 0.35, drag: 0.0001, color: 0x808080, name: 'Steel Ball' }
};

// Initialize the scene
function init() {
    console.log('Initializing Physics Ball Simulator...');
    
    // Get container dimensions
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    console.log('Container size:', width, 'x', height);

    // Three.js scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 100, 500);

    // Camera setup - fixed aspect ratio
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 50, 100);
    camera.lookAt(0, 25, 0);

    // Renderer setup - use container dimensions
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // Cannon.js physics world setup
    world = new CANNON.World();
    world.gravity.set(0, -9.81, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    // Create ground
    createGround();

    // Create platform
    createPlatform(30);

    // Setup event listeners
    setupEventListeners();

    // Update ball info display
    updateBallInfo();

    console.log('Initialization complete!');
    
    // Start animation loop
    animate();
}

// Create ground physics and mesh
function createGround() {
    // Cannon.js ground
    const groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    // Three.js ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x228B22,
        roughness: 0.8,
        metalness: 0.2
    });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 50, 0x000000, 0x000000);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

// Create platform at specified height
function createPlatform(height) {
    // Remove existing platform
    if (platformBody) {
        world.removeBody(platformBody);
    }
    if (platformMesh) {
        scene.remove(platformMesh);
    }

    // Cannon.js platform
    const platformShape = new CANNON.Box(new CANNON.Vec3(5, 0.5, 5));
    platformBody = new CANNON.Body({ mass: 0 });
    platformBody.addShape(platformShape);
    platformBody.position.set(0, height, 0);
    world.addBody(platformBody);

    // Three.js platform
    const platformGeometry = new THREE.BoxGeometry(10, 1, 10);
    const platformMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9
    });
    platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
    platformMesh.position.set(0, height, 0);
    platformMesh.castShadow = true;
    platformMesh.receiveShadow = true;
    scene.add(platformMesh);

    // Add railing
    const railingGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8);
    const railingMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    
    const positions = [
        [-4.5, height + 0.75, -4.5], [4.5, height + 0.75, -4.5],
        [-4.5, height + 0.75, 4.5], [4.5, height + 0.75, 4.5]
    ];
    
    positions.forEach(pos => {
        const railing = new THREE.Mesh(railingGeometry, railingMaterial);
        railing.position.set(...pos);
        scene.add(railing);
    });
}

// Create ball
function createBall(ballType, height) {
    console.log('Creating ball:', ballType, 'at height:', height);
    
    // Remove existing ball
    if (ballBody) {
        world.removeBody(ballBody);
        ballBody = null;
    }
    if (ballMesh) {
        scene.remove(ballMesh);
        ballMesh = null;
    }
    clearTrail();

    const props = ballProperties[ballType];

    // Cannon.js ball
    const ballShape = new CANNON.Sphere(props.radius);
    ballBody = new CANNON.Body({ 
        mass: props.mass,
        linearDamping: props.drag,
        angularDamping: 0.1
    });
    ballBody.addShape(ballShape);
    ballBody.position.set(0, height + props.radius, 0);
    ballBody.bounciness = props.bounciness;
    ballBody.friction = 0.3;
    world.addBody(ballBody);

    // Three.js ball
    const ballGeometry = new THREE.SphereGeometry(props.radius, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ 
        color: props.color,
        roughness: 0.4,
        metalness: ballType === 'steel' ? 0.9 : 0.1
    });
    ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ballMesh.position.copy(ballBody.position);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    console.log('Ball created! Position:', ballBody.position.y);

    // Update ball properties display
    document.getElementById('prop-mass').textContent = props.mass + ' kg';
    document.getElementById('prop-radius').textContent = props.radius + ' m';
    document.getElementById('prop-bounciness').textContent = props.bounciness.toFixed(2);
    document.getElementById('prop-drag').textContent = props.drag.toFixed(6);

    return props;
}

// Clear trail points
function clearTrail() {
    trailPoints.forEach(point => scene.remove(point));
    trailPoints = [];
}

// Add trail point
function addTrailPoint(position) {
    if (!document.getElementById('show-trail').checked) return;
    
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xFFFF00, 
        transparent: true, 
        opacity: 0.6 
    });
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(position);
    scene.add(point);
    trailPoints.push(point);

    // Limit trail points
    if (trailPoints.length > 100) {
        const oldPoint = trailPoints.shift();
        scene.remove(oldPoint);
    }
}

// Calculate air density based on weather
function getAirDensity(temp, humidity, pressure) {
    const tempK = temp + 273.15;
    const vaporPressure = humidity / 100 * 6.112 * Math.exp((17.67 * temp) / (temp + 243.5));
    const dryPressure = pressure * 100 - vaporPressure;
    return (dryPressure / (287.05 * tempK)) + (vaporPressure / (461.5 * tempK));
}

// Apply weather forces
function applyWeatherForces() {
    if (!ballBody || !isDropping) return;

    const temp = parseFloat(document.getElementById('temperature').value);
    const windSpeed = parseFloat(document.getElementById('wind-speed').value);
    const windDir = parseFloat(document.getElementById('wind-direction').value) * Math.PI / 180;
    const humidity = parseFloat(document.getElementById('humidity').value);
    const pressure = parseFloat(document.getElementById('pressure').value);

    if (document.getElementById('air-resistance').checked) {
        const airDensity = getAirDensity(temp, humidity, pressure);
        const velocity = ballBody.velocity;
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
        
        if (speed > 0.01) {
            const dragCoeff = ballProperties[document.getElementById('ball-type').value].drag;
            const dragForce = -0.5 * airDensity * dragCoeff * speed * velocity;
            ballBody.applyForce(new CANNON.Vec3(dragForce.x, dragForce.y, dragForce.z), ballBody.position);
        }
    }

    // Wind force
    if (windSpeed > 0) {
        const windForceX = Math.sin(windDir) * windSpeed * 0.1;
        const windForceZ = Math.cos(windDir) * windSpeed * 0.1;
        ballBody.applyForce(new CANNON.Vec3(windForceX, 0, windForceZ), ballBody.position);
    }
}

// Update statistics
function updateStats() {
    if (!ballBody) return;

    const currentY = ballBody.position.y;
    const props = ballProperties[document.getElementById('ball-type').value];
    const radius = props.radius;

    // Track maximum height
    if (currentY > maxHeight) {
        maxHeight = currentY;
    }

    // Track total distance
    const deltaY = Math.abs(currentY - lastY);
    totalDistance += deltaY;
    lastY = currentY;

    // Detect bounces
    if (currentY <= radius + 0.1 && Math.abs(ballBody.velocity.y) > 0.5) {
        bounceCount++;
    }

    // Calculate fall time
    const fallTime = isDropping ? (Date.now() - startTime) / 1000 : 0;

    // Calculate impact velocity (when near ground)
    if (currentY <= radius + 1) {
        impactVelocityRecorded = Math.abs(ballBody.velocity.y);
    }

    // Calculate energy loss
    const initialEnergy = props.mass * 9.81 * initialHeight;
    const currentEnergy = props.mass * 9.81 * maxHeight;
    const energyLoss = initialEnergy > 0 ? ((initialEnergy - currentEnergy) / initialEnergy * 100) : 0;

    // Update display
    document.getElementById('stat-height').textContent = initialHeight.toFixed(1) + ' m';
    document.getElementById('stat-fall-time').textContent = fallTime.toFixed(2) + ' s';
    document.getElementById('stat-bounce-height').textContent = maxHeight.toFixed(2) + ' m';
    document.getElementById('stat-impact-velocity').textContent = impactVelocityRecorded.toFixed(2) + ' m/s';
    document.getElementById('stat-bounce-count').textContent = bounceCount;
    document.getElementById('stat-total-distance').textContent = totalDistance.toFixed(2) + ' m';
    document.getElementById('stat-energy-loss').textContent = Math.max(0, energyLoss).toFixed(1) + '%';
}

// Animation loop
function animate() {
    animationId = requestAnimationFrame(animate);

    if (!isPaused && isDropping) {
        // Step physics
        world.step(1 / 60);

        // Apply weather forces
        applyWeatherForces();

        // Update ball mesh position
        if (ballMesh && ballBody) {
            ballMesh.position.copy(ballBody.position);
            ballMesh.quaternion.copy(ballBody.quaternion);

            // Add trail point every 10 frames
            if (trailPoints.length % 10 === 0) {
                addTrailPoint(ballBody.position.clone());
            }

            // Update stats
            updateStats();
        }
    }

    // Render
    renderer.render(scene, camera);
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Ball type change
    document.getElementById('ball-type').addEventListener('change', updateBallInfo);

    // Height type change
    document.getElementById('height-type').addEventListener('change', (e) => {
        const customInput = document.getElementById('custom-height');
        if (e.target.value === 'custom') {
            customInput.style.display = 'block';
        } else {
            customInput.style.display = 'none';
        }
    });

    // Weather slider updates
    ['temperature', 'wind-speed', 'wind-direction', 'humidity', 'pressure'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => {
                let valueId = id + '-value';
                if (id === 'wind-speed') valueId = 'wind-value';
                if (id === 'wind-direction') valueId = 'wind-dir-value';
                const valueElement = document.getElementById(valueId);
                if (valueElement) {
                    valueElement.textContent = e.target.value;
                }
            });
        }
    });

    // Drop button
    const dropBtn = document.getElementById('drop-btn');
    console.log('Drop button found:', dropBtn !== null);
    if (dropBtn) {
        dropBtn.addEventListener('click', function() {
            console.log('Drop button clicked!');
            dropBall();
        });
    }

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);

    // Pause button
    document.getElementById('pause-btn').addEventListener('click', togglePause);

    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    console.log('Event listeners setup complete!');
}

// Update ball info display
function updateBallInfo() {
    const ballType = document.getElementById('ball-type').value;
    const props = ballProperties[ballType];
    const infoBox = document.getElementById('ball-info');
    infoBox.innerHTML = `
        <strong>${props.name}</strong><br>
        Mass: ${props.mass} kg | Radius: ${props.radius} m<br>
        Bounciness: ${props.bounciness} | Drag: ${props.drag}
    `;
}

// Get current height
function getCurrentHeight() {
    const heightType = document.getElementById('height-type').value;
    if (heightType === 'custom') {
        return parseFloat(document.getElementById('custom-height').value) || 10;
    }
    return parseFloat(heightType);
}

// Drop ball
function dropBall() {
    console.log('dropBall() called, isDropping:', isDropping);
    
    if (isDropping) {
        console.log('Already dropping, returning');
        return;
    }

    const ballType = document.getElementById('ball-type').value;
    const height = getCurrentHeight();
    initialHeight = height;

    console.log('Dropping', ballType, 'from', height, 'm');

    // Reset stats
    maxHeight = 0;
    bounceCount = 0;
    totalDistance = 0;
    lastY = height;
    startTime = Date.now();
    impactVelocityRecorded = 0;

    // Create ball
    createBall(ballType, height);

    // Update platform height
    createPlatform(height);

    isDropping = true;
    console.log('Ball drop started!');
}

// Reset simulation
function resetSimulation() {
    isDropping = false;
    isPaused = false;
    document.getElementById('pause-btn').textContent = '⏸️ Pause';

    // Reset stats
    maxHeight = 0;
    bounceCount = 0;
    totalDistance = 0;
    lastY = 0;
    impactVelocityRecorded = 0;

    // Clear display
    document.getElementById('stat-fall-time').textContent = '0.00 s';
    document.getElementById('stat-bounce-height').textContent = '0 m';
    document.getElementById('stat-impact-velocity').textContent = '0 m/s';
    document.getElementById('stat-bounce-count').textContent = '0';
    document.getElementById('stat-total-distance').textContent = '0 m';
    document.getElementById('stat-energy-loss').textContent = '0%';
    document.getElementById('stat-height').textContent = '0 m';

    clearTrail();

    // Remove ball
    if (ballBody) {
        world.removeBody(ballBody);
        ballBody = null;
    }
    if (ballMesh) {
        scene.remove(ballMesh);
        ballMesh = null;
    }
    
    console.log('Simulation reset!');
}

// Toggle pause
function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pause-btn').textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
    console.log('Pause toggled:', isPaused);
}

// Window resize handler
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Initialize on load
window.addEventListener('load', init);
