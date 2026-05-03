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
        this.collisionMeshes = [];
        this.blockMeshes = [];
        this.buildMap();
        
        // Entity storage
        this.enemyMeshes = {};
        this.projMeshes = [];
    }

    createWedgeGeometry(w, h, d, dir) {
        const geo = new THREE.BufferGeometry();
        // Ramp slopes up towards North (-Z)
        const vertices = new Float32Array([
            // Base
            -w/2, 0, d/2,   w/2, 0, -d/2,   -w/2, 0, -d/2,
            -w/2, 0, d/2,   w/2, 0, d/2,    w/2, 0, -d/2,
            // Slope
            -w/2, 0, d/2,   w/2, h, -d/2,   w/2, 0, d/2,
            -w/2, 0, d/2,   -w/2, h, -d/2,  w/2, h, -d/2,
            // Back Wall
            -w/2, 0, -d/2,   w/2, h, -d/2,   -w/2, h, -d/2,
            -w/2, 0, -d/2,   w/2, 0, -d/2,   w/2, h, -d/2,
            // Left Wall
            -w/2, 0, d/2,   -w/2, h, -d/2,  -w/2, 0, -d/2,
            // Right Wall
            w/2, 0, d/2,    w/2, 0, -d/2,   w/2, h, -d/2
        ]);
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.computeVertexNormals();
        
        if (dir === 'S') geo.rotateY(Math.PI);
        else if (dir === 'E') geo.rotateY(-Math.PI/2);
        else if (dir === 'W') geo.rotateY(Math.PI/2);
        
        return geo;
    }

    buildMap() {
        const texLoader = new THREE.TextureLoader();
        
        let floors = this.mapData.floors || [];
        
        // Default ground plane just in case
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        this.scene.add(ground);
        this.collisionMeshes.push(ground);

        for (let floor of floors) {
            let floorY = floor.y || 0;
            
            for (let obj of floor.objects) {
                if (obj.type === 'block' || obj.type === 'ramp') {
                    let geo;
                    if (obj.type === 'block') {
                        geo = new THREE.BoxGeometry(obj.w, obj.h, obj.d);
                        geo.translate(0, obj.h/2, 0); // Bottom align
                    } else {
                        geo = this.createWedgeGeometry(obj.w, obj.h, obj.d, obj.dir);
                    }
                    
                    let matParams = { color: obj.color || 0x888888 };
                    if (obj.textureBase64) {
                        matParams.map = texLoader.load(obj.textureBase64);
                        matParams.map.magFilter = THREE.NearestFilter; // retro look
                        matParams.color = 0xffffff;
                    }
                    let mat = new THREE.MeshLambertMaterial(matParams);
                    let mesh = new THREE.Mesh(geo, mat);
                    
                    mesh.position.set(obj.x, floorY, obj.z);
                    this.scene.add(mesh);
                    this.collisionMeshes.push(mesh);
                    
                    if (obj.breakable) {
                        mesh.userData = { id: obj.id, hp: obj.hp };
                        this.blockMeshes.push(mesh);
                    }
                }
            }
        }
    }

    // Main render function called every frame
    render(player, enemies = [], projectiles = []) {
        // Update Camera Position
        this.camera.position.x = player.x;
        this.camera.position.y = player.y + player.eyeHeight;
        this.camera.position.z = player.z;

        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = player.yaw;
        this.camera.rotation.x = player.pitch;

        // Update Enemies
        for(let enemy of enemies) {
            if (!this.enemyMeshes[enemy.id]) {
                const group = new THREE.Group();
                this.scene.add(group);
                
                if (enemy.modelBase64 && window.THREE.GLTFLoader) {
                    const loader = new THREE.GLTFLoader();
                    loader.load(enemy.modelBase64, (gltf) => {
                        let model = gltf.scene;
                        // Scale it to roughly fit a 1x2x1 box
                        const box = new THREE.Box3().setFromObject(model);
                        const size = box.getSize(new THREE.Vector3());
                        const scale = 2 / Math.max(size.x, size.y, size.z);
                        model.scale.set(scale, scale, scale);
                        model.position.y -= 1; // Center bottom
                        group.add(model);
                    });
                } else {
                    const geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
                    const mat = new THREE.MeshLambertMaterial({ color: enemy.type === 'tank' ? 0xff00ff : 0x00ffff });
                    const mesh = new THREE.Mesh(geo, mat);
                    group.add(mesh);
                }
                
                // Add text sprite for HP
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 128;
                const tex = new THREE.CanvasTexture(canvas);
                const spriteMat = new THREE.SpriteMaterial({ map: tex });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.y = 1.5;
                sprite.scale.set(2, 1, 1);
                group.add(sprite);
                
                this.enemyMeshes[enemy.id] = { group, canvas, tex, sprite };
            }
            
            let obj = this.enemyMeshes[enemy.id];
            
            if (enemy.hp <= 0) {
                obj.group.visible = false;
                continue;
            }
            obj.group.visible = true;
            obj.group.position.set(enemy.x, enemy.y + 1, enemy.z);
            
            // Billboard to face player
            obj.group.lookAt(player.x, obj.group.position.y, player.z);
            
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
