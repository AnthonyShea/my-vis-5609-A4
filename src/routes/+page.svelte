<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { FontLoader, Font } from "three/addons/loaders/FontLoader.js";
  import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
  import { FirstPersonControls } from "three/addons/controls/FirstPersonControls.js";

  import { addGround, onWindowResize, loadModels } from "$lib/Helper-3D";

  import * as d3 from "d3";

  // Type for the summer movies data
  type TMovieData = {
      [key: string]: number;
  };
  
  let movieData: TMovieData = {}; // Store for display in UI

  // global variables for defining and controlling the 3D scene
  let container: HTMLElement;
  let camera: THREE.PerspectiveCamera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;
  const FLOOR = -250;

  const morphs: Array<THREE.Mesh> = [];
  let mixer: THREE.AnimationMixer;

  const clock = new THREE.Clock();
  
  // Scrolling variables
  let scrollOffset = 0;
  let maxScroll = 0;
  let isDragging = false;
  let previousMouseX = 0;

  onMount(async () => {
      // Load the summer movies data before initializing the scene
      movieData = await loadSummerMoviesData();
      init(window.innerWidth, window.innerHeight, movieData);
  });

  async function loadSummerMoviesData(): Promise<TMovieData> {
      try {
          // Load the CSV file
          console.log('Attempting to load CSV from: ./summer_movies.csv');
          const response = await fetch('./summer_movies.csv');
          
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const csvText = await response.text();
          console.log('CSV loaded, length:', csvText.length);
          console.log('First 200 characters:', csvText.substring(0, 200));
          
          // Parse CSV data
          const rows = d3.csvParse(csvText);
          console.log("Parsed CSV rows:", rows.length);
          
          // Log the first row to see what columns we have
          if (rows.length > 0) {
              console.log("First row:", rows[0]);
              console.log("Available columns:", Object.keys(rows[0]));
          }
          
          // Count movies by genre - try all possible column names
          const genreCounts: TMovieData = {};
          
          rows.forEach((row: any, index: number) => {
              // Try different possible column names for genre
              const genresStr = row.Genre || row.genre || row.GENRE || row.genres || row.Genres || row.GENRES;
              
              if (index < 3) {
                  console.log(`Row ${index} genre value:`, genresStr);
              }
              
              if (genresStr && genresStr.trim()) {
                  // Split by comma to get individual genres
                  const genresList = genresStr.split(',').map((g: string) => g.trim());
                  
                  // Count each individual genre
                  genresList.forEach((genre: string) => {
                      if (genre) {
                          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                      }
                  });
              }
          });
          
          console.log("Loaded movie data by genre:", genreCounts);
          console.log("Number of genres found:", Object.keys(genreCounts).length);
          
          if (Object.keys(genreCounts).length === 0) {
              console.warn('No genre data found in CSV - using sample data');
              throw new Error('No genre data found in CSV');
          }
          
          return genreCounts;
      } catch (error) {
          console.error("Error loading movie data:", error);
          console.log("Using sample data as fallback");
          // Return sample data as fallback
          return {
              'Action': 25,
              'Comedy': 18,
              'Drama': 15,
              'Horror': 12,
              'Sci-Fi': 20,
              'Animation': 10
          };
      }
  }

  function init(SCREEN_WIDTH: number, SCREEN_HEIGHT: number, movieData: TMovieData) {
      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      container.appendChild(renderer.domElement);

      // Camera - adjusted position for better view and less occlusion
      camera = new THREE.PerspectiveCamera(
          23,
          SCREEN_WIDTH / SCREEN_HEIGHT,
          10,
          3000,
      );
      camera.position.set(0, 150, 2400); // Moved further back and higher up

      // Scene
      scene = new THREE.Scene();
      // scene.background = new THREE.Color(0x87ceeb); // Sky color (light blue)
      new THREE.TextureLoader().load("3d/sky.jpg", (texture) => {
          texture.repeat.set(0.8, 1);
          scene.background = texture;
      });

      // Ambient Light
      const ambient = new THREE.AmbientLight(0xffffff);
      scene.add(ambient);

      // Directional Light
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(0, 1500, 1000);
      light.castShadow = true;
      Object.assign(light.shadow.camera, {
          top: 2000,
          bottom: -2000,
          left: -2000,
          right: 2000,
          near: 1200,
          far: 2500,
      });
      light.shadow.bias = 0.0001;
      light.shadow.mapSize.width = 2048;
      light.shadow.mapSize.height = 1024;
      scene.add(light);

      // GROUND (Grass)
      addGround(scene, FLOOR, "3d/grasslight-big.jpg");

      // Add text and bars with real data
      const fontLoader = new FontLoader();
      fontLoader.load("3d/helvetiker_bold.typeface.json", (font: Font) => {
          const textGeo = new TextGeometry("summer movies", {
              font: font,
              size: 40,
              depth: 15,
          });
          textGeo.computeBoundingBox();
          const centerOffset =
              -0.5 *
              (textGeo!.boundingBox!.max.x - textGeo!.boundingBox!.min.x);
          const textMaterial = new THREE.MeshStandardMaterial({
              color: 0x449900,
          });
          const titleMesh = new THREE.Mesh(textGeo, textMaterial);
          titleMesh.position.x = centerOffset;
          titleMesh.position.y = FLOOR + 600; // Moved up slightly
          titleMesh.castShadow = true;
          scene.add(titleMesh);

          // Create bars with real movie data
          createBars(scene, font, movieData);
      });

      // Load Models
      const models = [
          {
              path: "3d/Horse.glb",
              speed: 300,
              duration: 1,
              x: 100 - Math.random() * 1000,
              y: FLOOR,
              z: 300,
              scale: 0.5,
          },
          {
              path: "3d/Horse.glb",
              speed: 300,
              duration: 1,
              x: 100 - Math.random() * 1000,
              y: FLOOR,
              z: 450,
              scale: 0.5,
          },
          {
              path: "3d/Flamingo.glb",
              speed: 350,
              duration: 1,
              x: 300 - Math.random() * 500,
              y: FLOOR + 550,
              z: 100,
              scale: 0.5,
          },
          {
              path: "3d/Flamingo.glb",
              speed: 350,
              duration: 1,
              x: 300 - Math.random() * 500,
              y: FLOOR + 550,
              z: 200,
              scale: 0.5,
          },
          {
              path: "3d/Parrot.glb",
              speed: 350,
              duration: 0.5,
              x: 500 - Math.random() * 500,
              y: FLOOR + 500,
              z: 700,
              scale: 0.5,
          },
      ];
      mixer = loadModels(models, scene, mixer, morphs);

      // Handle resize
      window.addEventListener("resize", () =>
          onWindowResize(
              camera,
              renderer,
              window.innerWidth,
              window.innerHeight,
          ),
      );
      
      // Add mouse controls for horizontal scrolling
      container.addEventListener('mousedown', (e) => {
          isDragging = true;
          previousMouseX = e.clientX;
      });
      
      container.addEventListener('mousemove', (e) => {
          if (isDragging) {
              const deltaX = e.clientX - previousMouseX;
              scrollOffset -= deltaX * 5; // Drag left = scroll right (see more bars)
              scrollOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
              previousMouseX = e.clientX;
              console.log(`Scroll offset: ${scrollOffset.toFixed(0)} / ${maxScroll.toFixed(0)}`);
          }
      });
      
      container.addEventListener('mouseup', () => {
          isDragging = false;
      });
      
      container.addEventListener('mouseleave', () => {
          isDragging = false;
      });
      
      // Add keyboard controls for scrolling
      window.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
              scrollOffset -= 150;
              scrollOffset = Math.max(0, scrollOffset);
              console.log(`Scroll offset: ${scrollOffset.toFixed(0)} / ${maxScroll.toFixed(0)}`);
          } else if (e.key === 'ArrowRight') {
              scrollOffset += 150;
              scrollOffset = Math.min(scrollOffset, maxScroll);
              console.log(`Scroll offset: ${scrollOffset.toFixed(0)} / ${maxScroll.toFixed(0)}`);
          }
      });

      renderer.setAnimationLoop(animate);
  }

  function createBars(scene: THREE.Scene, font: Font, movieData: TMovieData) {
      const maxHeight = 400; // Maximum height of the bars
      const barWidth = 60; // Width of each bar
      const barSpacing = 150; // Increased space between bars

      // Sort genres by count (descending) for better visualization
      const sortedGenres = Object.keys(movieData).sort((a, b) => movieData[b] - movieData[a]);
      
      const totalWidth = sortedGenres.length * barSpacing;
      const viewportWidth = 1200; // Approximate visible width in 3D space
      // Calculate max scroll - need to scroll enough to see the last bar
      maxScroll = totalWidth - viewportWidth;
      
      console.log(`Total genres: ${sortedGenres.length}`);
      console.log(`Total width: ${totalWidth}`);
      console.log(`Max scroll: ${maxScroll}`);
      console.log(`Genres: ${sortedGenres.join(', ')}`);
      
      const yScale = d3
          .scaleLinear()
          .domain([0, Math.max(...Object.values(movieData))])
          .range([0, maxHeight]);

      // Create bars for each genre - start from position 200 (more to the right)
      sortedGenres.forEach((genre, i) => {
          const bar = createOneBar(
              yScale(movieData[genre]),
              barWidth,
          );
          
          // Position bars starting from 200, going positive to the right
          const xPosition = 200 + (i * barSpacing);
          bar.position.set(
              xPosition,
              FLOOR + yScale(movieData[genre]) / 2,
              -100,
          );
          bar.userData.baseX = xPosition; // Store base position for scrolling
          bar.userData.isBar = true; // Mark as a bar for scrolling
          scene.add(bar);

          // Add label with adjusted position
          const label = addLabelToBar(
              scene,
              `${genre}: ${movieData[genre]}`,
              xPosition - barWidth / 2,
              FLOOR + 10,
              50,
              font,
              xPosition,
          );
      });
  }

  function createOneBar(height: number, width: number) {
      const geometry = new THREE.CylinderGeometry(
          width / 2,
          width / 2,
          height,
          32,
      );

      const material = new THREE.MeshStandardMaterial({
          map: new THREE.TextureLoader().load("./3d/wood-texture.jpg"),
      });
      const bar = new THREE.Mesh(geometry, material);
      bar.castShadow = true;
      bar.receiveShadow = true;
      return bar;
  }

  function addLabelToBar(
      scene: THREE.Scene,
      text: string,
      x: number,
      y: number,
      z: number,
      font: Font,
      baseX: number,
  ) {
      const textGeometry = new TextGeometry(text, {
          font: font,
          size: 12,
          depth: 4,
      });

      const textMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
      });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);

      // Position the text above the bar
      textMesh.position.set(x, y, z);
      textMesh.userData.baseX = baseX; // Store base position for scrolling
      textMesh.userData.isBar = true; // Mark as scrollable
      textMesh.castShadow = true;
      textMesh.receiveShadow = false;

      scene.add(textMesh);
      return textMesh;
  }

  function animate() {
      // this function will be called every frame
      const delta = clock.getDelta();
      mixer.update(delta);

      // Update positions based on scroll offset - only for bars and labels
      scene.children.forEach((child) => {
          if (child.userData.isBar && child.userData.baseX !== undefined) {
              // Subtract scrollOffset to move bars left as we scroll right
              child.position.x = child.userData.baseX - scrollOffset;
          }
      });

      // You can comment out the following lines if you don't want the morphs to move
      morphs.forEach((morph) => {
          morph.position.x += morph.speed * delta;
          // Reset position if it goes off screen
          if (morph.position.x > window.innerWidth / 2) {
              morph.position.x = -window.innerWidth / 2 - Math.random() * 200;
          }
      });

      renderer.render(scene, camera);
  }
</script>

<div bind:this={container} class="container"></div>

<div class="controls-info">
  <h3>Controls</h3>
  <p>Click and drag left/right to scroll</p>
  <p>Use arrow keys ← → to scroll</p>
  <p>Showing {Object.keys(movieData || {}).length} genres</p>
</div>

<style>
  div.container {
      width: 100%;
      height: 100%;
      cursor: grab;
  }
  
  div.container:active {
      cursor: grabbing;
  }
  
  .controls-info {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      pointer-events: none;
  }
  
  .controls-info h3 {
      margin: 0 0 10px 0;
      font-size: 18px;
  }
  
  .controls-info p {
      margin: 5px 0;
      font-size: 14px;
  }
</style>