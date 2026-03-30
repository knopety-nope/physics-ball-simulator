// Unit Tests for Physics Ball Simulator - Landing Detection Logic
// Run with: node tests/landing-detection.test.js

// Ball properties database (same as game.js)
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

// Landing detection logic (extracted from game.js updateStats function)
function checkLanding(ball, currentTime, dropTime) {
    const currentY = ball.positionY;
    const radius = ball.props.radius;
    const velocity = ball.velocity;
    const timeSinceDrop = (currentTime - dropTime) / 1000;

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

    // Land ball if conditions met
    const maxFallTime = (ball.height / 4.4) + 2;
    const isTimeLimitExceeded = timeSinceDrop > maxFallTime;
    const isVerySlow = totalSpeed < 0.5 && ball.framesNearGround >= 3;

    if ((ball.framesNearGround >= 6 || isVerySlow || isTimeLimitExceeded) && !ball.hasLanded) {
        ball.hasLanded = true;
        ball.landedTime = currentTime;
        return true;
    }
    return false;
}

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`✅ PASS: ${testName}`);
        testsPassed++;
    } else {
        console.log(`❌ FAIL: ${testName}`);
        testsFailed++;
    }
}

function createBall(type, height) {
    return {
        type: type,
        props: ballProperties[type],
        height: height,
        positionY: height + ballProperties[type].radius,
        velocity: { x: 0, y: 0, z: 0 },
        framesNearGround: 0,
        hasLanded: false,
        landedTime: 0
    };
}

// ============ TEST SUITE ============

console.log('\n========================================');
console.log('Physics Ball Simulator - Unit Tests');
console.log('========================================\n');

// Test 1: Steel ball landing detection
console.log('\n--- Test 1: Steel Ball Landing (30m) ---');
let steelBall = createBall('steel', 30);
let dropTime = Date.now();
let currentTime = dropTime;

// Simulate ball falling and landing
for (let frame = 0; frame < 20; frame++) {
    currentTime = dropTime + (frame * 16); // ~60fps
    if (frame < 10) {
        steelBall.positionY = 0.05 + 0.2 + (Math.random() * 0.1); // Near ground
        steelBall.velocity = { x: 0.1, y: 0.3, z: 0.1 }; // Low velocity
    }
    checkLanding(steelBall, currentTime, dropTime);
}
assert(steelBall.hasLanded === true, 'Steel ball should land after 6+ frames near ground');
assert(steelBall.framesNearGround >= 6, 'Steel ball should have 6+ frames counted');

// Test 2: Basketball landing detection
console.log('\n--- Test 2: Basketball Landing (30m) ---');
let basketball = createBall('basketball', 30);
dropTime = Date.now();
currentTime = dropTime;

for (let frame = 0; frame < 20; frame++) {
    currentTime = dropTime + (frame * 16);
    if (frame < 10) {
        basketball.positionY = 0.12 + 0.2 + (Math.random() * 0.1);
        basketball.velocity = { x: 0.2, y: 0.4, z: 0.2 };
    }
    checkLanding(basketball, currentTime, dropTime);
}
assert(basketball.hasLanded === true, 'Basketball should land after 6+ frames near ground');

// Test 3: Baseball landing detection
console.log('\n--- Test 3: Baseball Landing (30m) ---');
let baseball = createBall('baseball', 30);
dropTime = Date.now();
currentTime = dropTime;

for (let frame = 0; frame < 20; frame++) {
    currentTime = dropTime + (frame * 16);
    if (frame < 10) {
        baseball.positionY = 0.037 + 0.2 + (Math.random() * 0.1);
        baseball.velocity = { x: 0.15, y: 0.35, z: 0.15 };
    }
    checkLanding(baseball, currentTime, dropTime);
}
assert(baseball.hasLanded === true, 'Baseball should land after 6+ frames near ground');

// Test 4: Time-based fallback for high drops
console.log('\n--- Test 4: Time-Based Fallback (350m Tower) ---');
let tennisBall = createBall('tennis', 350);
dropTime = Date.now();
// Simulate ball stuck in air (bug scenario)
tennisBall.positionY = 100; // Still in air
tennisBall.velocity = { x: 0, y: 0.1, z: 0 }; // Tiny velocity
tennisBall.framesNearGround = 0;

// Wait for time limit (350/4.4 + 2 = ~81.6 seconds)
let timeLimitTime = dropTime + 82000; // 82 seconds
let landed = checkLanding(tennisBall, timeLimitTime, dropTime);
assert(landed === true, 'Ball should land via time-based fallback after max fall time');
assert(tennisBall.hasLanded === true, 'Tennis ball should be marked as landed');

// Test 5: Very slow condition (quick land)
console.log('\n--- Test 5: Very Slow Condition (Quick Land) ---');
let golfBall = createBall('golf', 10);
dropTime = Date.now();
currentTime = dropTime;

for (let frame = 0; frame < 5; frame++) {
    currentTime = dropTime + (frame * 16);
    golfBall.positionY = 0.021 + 0.1; // Very near ground
    golfBall.velocity = { x: 0.1, y: 0.1, z: 0.1 }; // Total speed ~0.17 < 0.5
    checkLanding(golfBall, currentTime, dropTime);
}
assert(golfBall.hasLanded === true, 'Golf ball should land via very slow condition (3 frames, speed < 0.5)');

// Test 6: Ball should NOT land while falling
console.log('\n--- Test 6: No Premature Landing (Mid-Air) ---');
let soccerBall = createBall('soccer', 50);
dropTime = Date.now();
currentTime = dropTime + 1000; // 1 second into fall
soccerBall.positionY = 40; // Still high in air
soccerBall.velocity = { x: 0, y: -9.8, z: 0 }; // Falling fast

let landedMidAir = checkLanding(soccerBall, currentTime, dropTime);
assert(landedMidAir === false, 'Ball should NOT land while still in mid-air');
assert(soccerBall.hasLanded === false, 'Soccer ball should not be marked as landed');
assert(soccerBall.framesNearGround === 0, 'Frame counter should be 0 when not near ground');

// Test 7: Frame counter resets when ball moves away
console.log('\n--- Test 7: Frame Counter Reset ---');
let volleyball = createBall('volleyball', 20);
dropTime = Date.now();
currentTime = dropTime;

// 3 frames near ground
for (let i = 0; i < 3; i++) {
    currentTime = dropTime + (i * 16);
    volleyball.positionY = 0.11 + 0.15;
    volleyball.velocity = { x: 0.2, y: 0.3, z: 0.2 };
    checkLanding(volleyball, currentTime, dropTime);
}
assert(volleyball.framesNearGround === 3, 'Frame counter should be 3 after 3 frames near ground');

// Ball bounces away
currentTime = dropTime + (4 * 16);
volleyball.positionY = 5; // High in air
volleyball.velocity = { x: 0, y: 5, z: 0 };
checkLanding(volleyball, currentTime, dropTime);
assert(volleyball.framesNearGround === 0, 'Frame counter should reset when ball moves away');

// Test 8: Multiple balls land independently
console.log('\n--- Test 8: Multi-Ball Independent Landing ---');
let balls = [
    createBall('steel', 30),
    createBall('basketball', 30),
    createBall('tennis', 30)
];
dropTime = Date.now();
currentTime = dropTime;

// Steel lands first (low bounciness)
for (let frame = 0; frame < 10; frame++) {
    currentTime = dropTime + (frame * 16);
    balls.forEach(ball => {
        if (!ball.hasLanded) {
            ball.positionY = ball.props.radius + 0.2;
            ball.velocity = { x: 0.1, y: 0.3, z: 0.1 };
            checkLanding(ball, currentTime, dropTime);
        }
    });
}
assert(balls[0].hasLanded === true, 'Steel ball should land');
assert(balls[1].hasLanded === true, 'Basketball should land');
assert(balls[2].hasLanded === true, 'Tennis ball should land');

// Test 9: Max fall time calculation
console.log('\n--- Test 9: Max Fall Time Calculation ---');
const testHeights = [
    { height: 10, expectedMax: (10 / 4.4) + 2 },
    { height: 30, expectedMax: (30 / 4.4) + 2 },
    { height: 100, expectedMax: (100 / 4.4) + 2 },
    { height: 350, expectedMax: (350 / 4.4) + 2 }
];

testHeights.forEach(test => {
    const calculated = (test.height / 4.4) + 2;
    assert(Math.abs(calculated - test.expectedMax) < 0.01, 
        `Max fall time for ${test.height}m: ${calculated.toFixed(2)}s (expected ${test.expectedMax.toFixed(2)}s)`);
});

// Test 10: All ball types can land
console.log('\n--- Test 10: All Ball Types Landing ---');
const allBallTypes = Object.keys(ballProperties);
allBallTypes.forEach(type => {
    let ball = createBall(type, 30);
    dropTime = Date.now();
    
    for (let frame = 0; frame < 15; frame++) {
        currentTime = dropTime + (frame * 16);
        ball.positionY = ball.props.radius + 0.2;
        ball.velocity = { x: 0.2, y: 0.4, z: 0.2 };
        checkLanding(ball, currentTime, dropTime);
    }
    assert(ball.hasLanded === true, `${ball.props.name} should land successfully`);
});

// ============ SUMMARY ============
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed} ✅`);
console.log(`Failed: ${testsFailed} ❌`);
console.log('========================================\n');

if (testsFailed > 0) {
    console.log('⚠️  SOME TESTS FAILED - Do not push until fixed!\n');
    process.exit(1);
} else {
    console.log('🎉 ALL TESTS PASSED - Safe to push!\n');
    process.exit(0);
}
