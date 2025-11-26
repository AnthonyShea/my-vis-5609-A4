<!-- src/routes/A3/+page.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import type { TMovie } from "../../types";
    import { Scroll } from "$lib";

    let movies: TMovie[] = [];

    async function loadCsv() {
      movies = await d3.csv("./summer_movies.csv", row => ({
        ...row,
        num_votes: +row.num_votes,
        runtime_minutes: +row.runtime_minutes,
        genres: row.genres.split(","),
        year: new Date(row.year),
        average_rating: +row.average_rating,
      }));
      console.log("[Page] CSV loaded, movies length →", movies.length);
    }

    onMount(loadCsv);
</script>

<div class="container">
    <Scroll {movies}>
      {#if movies.length}
        {#each d3.groups(movies, d => d.year.getFullYear()).sort(([a],[b]) => a - b) as [year, yearMovies] (year)}
          <div class="step">
            <h3 class="year">{year}</h3>
            {#each yearMovies as movie}
              <b class="movie-title">{movie.primary_title}:</b>
              {movie.genres.join(" | ")}<br />
            {/each}
          </div>
        {/each}
      {/if}
    </Scroll>
</div>

<style>
    .container { width:80vw; margin:2rem auto; }
    .step { margin-bottom:2rem; padding:1rem; }
    .year { margin:0 0 .5rem; font-size:1.5rem; color:#333; }
    .movie-title { color:#449900; }
</style>