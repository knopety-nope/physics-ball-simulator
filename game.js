// Physics Ball Simulator - Multi-Ball Edition
// Using Three.js for 3D rendering and Cannon.js for physics

// Global variables
let scene, camera, renderer, world;
let balls = []; // Array to store all ball objects
let groundMesh, groundBody;
let platformMesh, platformBody;
let isDropping = false;
let isPaused = false;
let startTime = 0;
let animationId = null;

// Ball properties database - expanded with more types
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

// Ball class to track individual ball state
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
        this.startTime = Date.now();
        this.hasLanded = false;
        this.firstBounceHeight = 0;
    }
}

// Initialize the scene
function init() {
    console.log('Initializing Physics Ball Simulator...');
    
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    console.log('Container size:', width, 'x', height);

    // Three.js scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 100, 500);

    // Camera setup
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 50, 150);
    camera.lookAt(0, 30, 0);

    // Renderer setup
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
    scene.add(directionalLight);

    // Cannon.js physics world
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

// Create ground
function createGround() {
    const groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    const groundGeometry = new THREE.PlaneGeometry(300, 300);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const gridHelper = new THREE.GridHelper(300, 50, 0x000000, 0x000000);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

// Create platform at specified height
function createPlatform(height) {
    if (platformBody) {
        world.removeBody(platformBody);
    }
    if (platformMesh) {
        scene.remove(platformMesh);
    }

    const platformShape = new CANNON.Box(new CANNON.Vec3(8, 0.5, 8));
    platformBody = new CANNON.Body({ mass: 0 });
    platformBody.addShape(platformShape);
    platformBody.position.set(0, height, 0);
    world.addBody(platformBody);

    const platformGeometry = new THREE.BoxGeometry(16, 1, 16);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
    platformMesh.position.set(0, height, 0);
    platformMesh.castShadow = true;
    platformMesh.receiveShadow = true;
    scene.add(platformMesh);
}

// Create a single ball
function createBall(ball) {
    const props = ball.props;
    const xPos = ball.xOffset;

    // Cannon.js ball body
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

    // Three.js ball mesh
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

// Clear all balls
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
}

// Add trail point for a ball
function addTrailPoint(ball) {
    if (!document.getElementById('show-trail').checked) return;
    
    const geometry = new THREE.SphereGeometry(0.15, 6, 6);
    const material = new THREE.MeshBasicMaterial({ 
        color: ball.props.color, 
        transparent: true, 
        opacity: 0.5 
    });
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(ball.body.position);
    scene.add(point);
    ball.trailPoints.push(point);

    if (ball.trailPoints.length > 80) {
        const oldPoint = ball.trailPoints.shift();
        scene.remove(oldPoint);
    }
}

// Calculate air density
function getAirDensity(temp, humidity, pressure) {
    const tempK = temp + 273.15;
    const vaporPressure = humidity / 100 * 6.112 * Math.exp((17.67 * temp) / (temp + 243.5));
    const dryPressure = pressure * 100 - vaporPressure;
    return (dryPressure / (287.05 * tempK)) + (vaporPressure / (461.5 * tempK));
}

// Apply weather forces to all balls
function applyWeatherForces() {
    if (!isDropping) return;

    const temp = parseFloat(document.getElementById('temperature').value);
    const windSpeed = parseFloat(document.getElementById('wind-speed').value);
    const windDir = parseFloat(document.getElementById('wind-direction').value) * Math.PI / 180;
    const humidity = parseFloat(document.getElementById('humidity').value);
    const pressure = parseFloat(document.getElementById('pressure').value);

    balls.forEach(ball => {
        if (!ball.body) return;

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

// Update statistics for all balls
function updateStats() {
    balls.forEach(ball => {
        if (!ball.body) return;

        const currentY = ball.body.position.y;
        const radius = ball.props.radius;

        // Track max height
        if (currentY > ball.maxHeight) {
            ball.maxHeight = currentY;
        }

        // Track distance
        ball.totalDistance += Math.abs(currentY - ball.lastY);
        ball.lastY = currentY;

        // Detect bounces
        if (currentY <= radius + 0.1 && Math.abs(ball.body.velocity.y) > 0.5) {
            ball.bounceCount++;
            if (ball.bounceCount === 1) {
                ball.firstBounceHeight = ball.maxHeight;
            }
        }

        // Track impact velocity
        if (currentY <= radius + 1) {
            ball.impactVelocity = Math.abs(ball.body.velocity.y);
        }

        // Mark as landed
        if (currentY <= radius + 0.05 && Math.abs(ball.body.velocity.y) < 0.1) {
            ball.hasLanded = true;
        }
    });

    renderStats();
    renderComparison();
}

// Render statistics panel
function renderStats() {
    const statsContent = document.getElementById('stats-content');
    if (balls.length === 0) {
        statsContent.innerHTML = '<p class="hint">Drop balls to see statistics</p>';
        return;
    }

    let html = '';
    const fallTime = isDropping ? ((Date.now() - startTime) / 1000).toFixed(2) : '0.00';

    balls.forEach((ball, index) => {
        const color = '#' + ball.props.color.toString(16).padStart(6, '0');
        html += `
            <div class="stat-ball" style="border-left-color: ${color}">
                <h4 style="color: ${color}">${ball.props.name}</h4>
                <div class="stat-row"><span>Fall Time:</span><span>${fallTime} s</span></div>
                <div class="stat-row"><span>Max Height:</span><span>${ball.maxHeight.toFixed(2)} m</span></div>
                <div class="stat-row"><span>Bounces:</span><span>${ball.bounceCount}</span></div>
                <div class="stat-row"><span>Impact Velocity:</span><span>${ball.impactVelocity.toFixed(2)} m/s</span></div>
                <div class="stat-row"><span>Distance:</span><span>${ball.totalDistance.toFixed(2)} m</span></div>
            </div>
        `;
    });

    statsContent.innerHTML = html;
}

// Render comparison table
function renderComparison() {
    const comparisonContent = document.getElementById('comparison-content');
    if (balls.length < 2) {
        comparisonContent.innerHTML = '<p class="hint">Select multiple balls to compare</p>';
        return;
    }

    // Find winners
    let highestBounce = { ball: null, value: 0 };
    let fastestFall = { ball: null, value: Infinity };
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

// Animation loop
function animate() {
    animationId = requestAnimationFrame(animate);

    if (!isPaused && isDropping) {
        world.step(1 / 60);
        applyWeatherForces();

        balls.forEach(ball => {
            if (ball.mesh && ball.body) {
                ball.mesh.position.copy(ball.body.position);
                ball.mesh.quaternion.copy(ball.body.quaternion);

                if (balls.length % 5 === 0) {
                    addTrailPoint(ball);
                }
            }
        });

        updateStats();
    }

    renderer.render(scene, camera);
}

// Setup event listeners
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

    const dropBtn = document.getElementById('drop-btn');
    console.log('Drop button found:', dropBtn !== null);
    if (dropBtn) {
        dropBtn.addEventListener('click', dropBalls);
    }

    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    window.addEventListener('resize', onWindowResize);

    console.log('Event listeners setup complete!');
}

// Update ball info display
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

// Get current height
function getCurrentHeight() {
    const heightType = document.getElementById('height-type').value;
    if (heightType === 'custom') {
        return parseFloat(document.getElementById('custom-height').value) || 10;
    }
    return parseFloat(heightType);
}

// Drop all selected balls
function dropBalls() {
    console.log('dropBalls() called, isDropping:', isDropping);
    
    if (isDropping) {
        console.log('Already dropping, returning');
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

    // Reset and create balls with offsets for visual separation
    clearAllBalls();
    
    const totalBalls = selectedOptions.length;
    const spacing = Math.min(2, 10 / totalBalls);
    const startX = -((totalBalls - 1) * spacing) / 2;

    selectedOptions.forEach((option, index) => {
        const xOffset = startX + (index * spacing);
        const ball = new Ball(option.value, height, xOffset);
        balls.push(ball);
        createBall(ball);
    });

    startTime = Date.now();
    isDropping = true;
    console.log('Ball drop started!', balls.length, 'balls');
}

// Reset simulation
function resetSimulation() {
    isDropping = false;
    isPaused = false;
    document.getElementById('pause-btn').textContent = '⏸️ Pause';

    clearAllBalls();

    document.getElementById('stats-content').innerHTML = '<p class="hint">Drop balls to see statistics</p>';
    document.getElementById('comparison-content').innerHTML = '<p class="hint">Select multiple balls to compare</p>';

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
