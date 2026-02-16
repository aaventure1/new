/**
 * AAVenture Serenity Engine - WebGL Visualization
 * Powered by Three.js
 * Innovative approach: Atmosphere reacts to Community Pulse
 */

class SerenityEngine {
    constructor() {
        this.container = document.getElementById('serenityVisualizer');
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        this.particles = null;
        this.pulseStrength = 0.75; // Initial 75%
        
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;

        // Create Particle Field
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let i = 0; i < 5000; i++) {
            vertices.push(
                Math.random() * 20 - 10,
                Math.random() * 20 - 10,
                Math.random() * 20 - 10
            );
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.PointsMaterial({
            size: 0.05,
            color: 0x6366f1,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        // Level artifact - 3D object that evolves with progress
        this.levelArtifact = null;
        this.currentLevel = 1;

        this.animate();
        this.handleResize();
    }

    /**
     * Creates or updates the level artifact based on user level
     */
    updateLevelArtifact(level) {
        this.currentLevel = level;

        if (this.levelArtifact) {
            this.scene.remove(this.levelArtifact);
        }

        // Evolution logic: Simple -> Complex Geometry
        let geometry;
        if (level < 5) geometry = new THREE.BoxGeometry(1, 1, 1);
        else if (level < 10) geometry = new THREE.OctahedronGeometry(1);
        else if (level < 20) geometry = new THREE.IcosahedronGeometry(1);
        else geometry = new THREE.TorusKnotGeometry(0.7, 0.3, 100, 16);

        const material = new THREE.MeshPhongMaterial({
            color: 0x6366f1,
            emissive: 0x111111,
            shininess: 100,
            transparent: true,
            opacity: 0.8,
            wireframe: true
        });

        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(5, 5, 5);
        this.scene.add(light);

        this.levelArtifact = new THREE.Mesh(geometry, material);
        this.levelArtifact.position.set(0, 0, 0); // Positioned in background
        this.scene.add(this.levelArtifact);
    }

    /**
     * Immersive Innovation: The Circle of Hope
     * Renders glowing orbs for active meeting participants
     */
    updateMeetingCircle(participantCount) {
        if (this.meetingGroup) {
            this.scene.remove(this.meetingGroup);
        }

        this.meetingGroup = new THREE.Group();
        const radius = 3;

        for (let i = 0; i < participantCount; i++) {
            const angle = (i / participantCount) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const orbGeo = new THREE.SphereGeometry(0.2, 16, 16);
            const orbMat = new THREE.MeshBasicMaterial({ 
                color: 0x10b981, 
                transparent: true, 
                opacity: 0.8 
            });
            const orb = new THREE.Mesh(orbGeo, orbMat);
            orb.position.set(x, y, -2);
            this.meetingGroup.add(orb);
        }

        this.scene.add(this.meetingGroup);
    }

    setPulse(strength) {
        this.pulseStrength = strength / 100;
        if (this.particles) {
            // Shift color based on strength
            // High Strength = Teal/Green, Lower = Blue/Purple
            const color = new THREE.Color();
            color.setHSL(0.5 + (this.pulseStrength * 0.2), 0.8, 0.6);
            this.particles.material.color = color;
        }
    }

    handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = Date.now() * 0.0001;
        this.particles.rotation.y = time * (0.1 + this.pulseStrength);
        this.particles.rotation.x = time * (0.05 + (this.pulseStrength * 0.5));

        this.renderer.render(this.scene, this.camera);
    }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
    window.serenityEngine = new SerenityEngine();
});
