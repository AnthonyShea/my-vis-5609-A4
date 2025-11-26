<!-- src/lib/Scroll.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import type { TMovie } from "../types";
  import { RankBar } from "$lib";

  type Props = { movies: TMovie[] };
  let { movies }: Props = $props();

  /* --------------------------------------------------------------
   *  1. Debug: raw movies
   * ------------------------------------------------------------ */
  $effect(() => {
    console.log("[Scroll] raw movies length →", movies.length);
  });

  /* --------------------------------------------------------------
   *  2. Group movies by year (filter out NaN)
   * ------------------------------------------------------------ */
  const moviesByYear = $derived.by(() => {
    if (!movies.length) return [];
    const groups = d3.groups(movies, d => d.year.getFullYear())
      .filter(([year]) => !isNaN(year));
    const sorted = groups.sort(([a], [b]) => a - b);
    console.log("[Scroll] moviesByYear →", sorted.map(([y]) => y));
    return sorted;
  });

  const years = $derived(moviesByYear.map(([y]) => y));
  
  /* --------------------------------------------------------------
   *  3. Current year – mutable state
   * ------------------------------------------------------------ */
  let currentYear = $state(0);
  
  const prevYear = $derived(currentYear - 10);

  /* --------------------------------------------------------------
   *  4. Aggregate genre counts
   * ------------------------------------------------------------ */
  const aggregateYear = (year: number) => {
    if (!movies.length || !year) return [];
    
    const map = d3.rollup(
      movies
        .filter(m => m.year.getFullYear() === year)
        .flatMap(m => m.genres),
      v => v.length,
      d => d
    );
    const arr = Array.from(map, ([g, c]) => ({ genre: g, count: c }))
      .sort((a, b) => b.count - a.count);
    return arr;
  };

  // Aggregate genres over a 10-year range (inclusive)
  const aggregateYearRange = (endYear: number) => {
    if (!movies.length || !endYear) return [];
    
    const startYear = endYear - 10;
    
    const map = d3.rollup(
      movies
        .filter(m => {
          const movieYear = m.year.getFullYear();
          return movieYear >= startYear && movieYear <= endYear;
        })
        .flatMap(m => m.genres),
      v => v.length,
      d => d
    );
    const arr = Array.from(map, ([g, c]) => ({ genre: g, count: c }))
      .sort((a, b) => b.count - a.count);
    return arr;
  };

  const currentData = $derived(aggregateYear(currentYear));
  const prevData    = $derived(aggregateYearRange(currentYear));

  /* --------------------------------------------------------------
   *  5. Scrollytelling Logic - Track visible steps
   * ------------------------------------------------------------ */
  let container: HTMLElement;
  let storySection: HTMLElement;

  // Use an effect that reacts to movies data changes
  $effect(() => {
    if (!movies.length || !container || !storySection) return;

    console.log("[Scroll] Initializing scroll observer with", years.length, "years");
    
    // Set initial year to first valid year
    if (years.length > 0 && currentYear === 0) {
      currentYear = years[0];
      console.log("[Scroll] Set initial year to:", currentYear);
    }

    let intersectionObserver: IntersectionObserver;

    function findVisibleYear(): void {
      const steps = storySection.querySelectorAll('.step');
      if (!steps.length) return;

      const viewportMiddle = window.innerHeight / 2;
      
      // Find the step closest to the middle of the viewport
      let closestStep: Element | null = null;
      let closestDistance = Infinity;

      steps.forEach(step => {
        const rect = step.getBoundingClientRect();
        const stepMiddle = rect.top + rect.height / 2;
        const distance = Math.abs(stepMiddle - viewportMiddle);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestStep = step;
        }
      });

      if (closestStep) {
        const yearHeader = closestStep.querySelector('.year');
        if (yearHeader) {
          const newYear = parseInt(yearHeader.textContent || '0');
          if (newYear !== currentYear && !isNaN(newYear)) {
            console.log("[Scroll] Visible year:", newYear);
            currentYear = newYear;
          }
        }
      }
    }

    function handleIntersection(entries: IntersectionObserverEntry[]) {
      const entry = entries[0];
      if (entry.isIntersecting) {
        console.log("[Scroll] Container is intersecting, setting up listeners");
        findVisibleYear();
        window.addEventListener("scroll", findVisibleYear, { passive: true });
      } else {
        console.log("[Scroll] Container not intersecting, removing listeners");
        window.removeEventListener("scroll", findVisibleYear);
      }
    }

    intersectionObserver = new IntersectionObserver(handleIntersection, { 
      threshold: 0,
      rootMargin: "0px"
    });

    intersectionObserver.observe(container);

    // Initial calculation
    findVisibleYear();

    return () => {
      console.log("[Scroll] Cleaning up observers");
      intersectionObserver?.disconnect();
      window.removeEventListener("scroll", findVisibleYear);
    };
  });

  /* --------------------------------------------------------------
   *  6. Setup container reference
   * ------------------------------------------------------------ */
  function setupContainer(node: HTMLElement) {
    container = node;
    return {
      destroy() {
        // Cleanup will be handled by the effect
      }
    };
  }

  function setupStory(node: HTMLElement) {
    storySection = node;
    return {
      destroy() {
        // Cleanup will be handled by the effect
      }
    };
  }

  /* --------------------------------------------------------------
   *  7. Debug effects
   * ------------------------------------------------------------ */
  $effect(() => {
    console.log("[Scroll] years →", years);
  });

  $effect(() => {
    if (currentYear > 0) {
      console.log("[Scroll] currentYear →", currentYear, "prevYear →", prevYear);
    }
  });
</script>

<!-- Layout -->
<section class="scrolly" use:setupContainer>
  <section class="story" use:setupStory>
    <slot />
  </section>
  
  <section class="viz">
    <div class="viz-wrapper">
      <div class="pair">
        <div class="col">
          <h4>Previous 10 years – {prevYear} to {currentYear}</h4>
          <RankBar data={prevData} width={280} height={650} />
        </div>
        <div class="col">
          <h4>Current year – {currentYear}</h4>
          <RankBar data={currentData} width={280} height={650} />
        </div>
      </div>
      <p class="note">Scroll through the years to see genre evolution.</p>
    </div>
  </section>
</section>

<style>
  .scrolly {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    min-height: 100vh;
  }

  .viz,
  .story {
    grid-row: 1;
  }

  .viz {
    position: sticky;
    top: 2rem;
    max-height: 100vh;
    align-self: start;
  }

  .pair {
    display: flex;
    gap: 2rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .col {
    text-align: center;
  }

  h4 {
    margin: 0 0 .5rem;
    font-size: .9rem;
    color: #555;
  }

  .note {
    margin-top: 1rem;
    font-size: .85rem;
    color: #777;
    font-style: italic;
    text-align: center;
  }
</style>