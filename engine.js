class Engine {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.mapData = mapData;
        
        // Setup Three.js Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e); // Retro dark blue sky
        this.scene.fog = new THREE.Fog(0x1a1a2e, 0, 30); // Distance fog
        
        // Camera (FOV 75, aspect ratio, near clip, far clip)
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
        this.renderer.setSize(this.width, this.height);
        this.renderer.domElement.style.imageRendering = 'pixelated';
        
        // Handle Window Resize
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.renderer.setSize(this.width, this.height);
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
        });

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // Build Map and Colliders
        this.colliders = [];
        this.buildMap();
        
        // Entity storage
        this.enemyMeshes = {};
        this.projMeshes = [];
    }

    buildMap() {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Create boxes from mapData
        for(let block of this.mapData.blocks) {
            const geo = new THREE.BoxGeometry(block.w, block.h, block.d);
            const mat = new THREE.MeshLambertMaterial({ color: block.color });
            const mesh = new THREE.Mesh(geo, mat);
            
            // In Three.js, position is the center of the geometry.
            mesh.position.set(block.x, block.y + block.h / 2, block.z);
            this.scene.add(mesh);
            
            // Add to our AABB collision list
            this.colliders.push({
                minX: block.x - block.w / 2, maxX: block.x + block.w / 2,
                minY: block.y,               maxY: block.y + block.h,
                minZ: block.z - block.d / 2, maxZ: block.z + block.d / 2
            });
        }
    }

    // Main render function called every frame
    render(player, enemies = [], projectiles = []) {
        // Update Camera Position
        this.camera.position.x = player.x;
        this.camera.position.y = player.y + player.eyeHeight; // player.y is feet level
        this.camera.position.z = player.z;

        // Apply rotation (Euler order YXZ is standard for FPS cameras)
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = player.yaw;
        this.camera.rotation.x = player.pitch;

        // Update Enemies
        for(let enemy of enemies) {
            if (!this.enemyMeshes[enemy.id]) {
                const geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
                const mat = new THREE.MeshLambertMaterial({ color: enemy.type === 'tank' ? 0xff00ff : 0x00ffff });
                const mesh = new THREE.Mesh(geo, mat);
                this.scene.add(mesh);
                
                // Add text sprite for HP
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 128;
                const tex = new THREE.CanvasTexture(canvas);
                const spriteMat = new THREE.SpriteMaterial({ map: tex });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.y = 1.5;
                sprite.scale.set(2, 1, 1);
                mesh.add(sprite);
                
                this.enemyMeshes[enemy.id] = { mesh, canvas, tex, sprite };
            }
            
            let obj = this.enemyMeshes[enemy.id];
            
            if (enemy.hp <= 0) {
                obj.mesh.visible = false;
                continue;
            }
            obj.mesh.visible = true;
            obj.mesh.position.set(enemy.x, enemy.y + 1, enemy.z); // y+1 because height is 2
            
            // Update HP text
            let ctx = obj.canvas.getContext('2d');
            ctx.clearRect(0, 0, 256, 128);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(`HP: ${Math.ceil(enemy.hp)}`, 128, 64);
            obj.tex.needsUpdate = true;
        }
        
        // Update Projectiles
        while(this.projMeshes.length < projectiles.length) {
            const geo = new THREE.SphereGeometry(0.2, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const mesh = new THREE.Mesh(geo, mat);
            this.scene.add(mesh);
            this.projMeshes.push(mesh);
        }
        for(let i = 0; i < this.projMeshes.length; i++) {
            if (i < projectiles.length) {
                this.projMeshes[i].visible = true;
                this.projMeshes[i].position.set(projectiles[i].x, projectiles[i].y, projectiles[i].z);
            } else {
                this.projMeshes[i].visible = false;
            }
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}
