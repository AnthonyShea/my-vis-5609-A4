<!-- GenreHeatmap.svelte -->
<script lang="ts">
  import type { TMovie } from "../types";
  import * as d3 from "d3";

  type Props = {
    movies: TMovie[];
    width?: number;
    height?: number;
  };

  let { movies, width = 800, height = 600 }: Props = $props();

  let svgElement: SVGSVGElement | null = null;

  // Derived values
  const genres = $derived.by(() => {
    const allGenres = new Set<string>();
    movies.forEach(m => m.genres.forEach(g => allGenres.add(g)));
    return Array.from(allGenres).sort();
  });

  // Compute co-occurrence matrix
  const coMatrix = $derived.by(() => {
    const matrix: { [row: string]: { [col: string]: number } } = {};
    genres.forEach(g => {
      matrix[g] = {};
      genres.forEach(h => {
        matrix[g][h] = 0;
      });
    });

    // Diagonal: total movies per genre
    const genreTotals: { [g: string]: number } = {};
    movies.forEach(m => {
      m.genres.forEach(g => {
        genreTotals[g] = (genreTotals[g] || 0) + 1;
      });
    });
    genres.forEach(g => matrix[g][g] = genreTotals[g] || 0);

    // Off-diagonal: co-occurrences
    movies.forEach(m => {
      const gs = m.genres;
      for (let i = 0; i < gs.length; i++) {
        for (let j = i + 1; j < gs.length; j++) {
          const g1 = gs[i], g2 = gs[j];
          matrix[g1][g2]++;
          matrix[g2][g1]++;
        }
      }
    });

    return matrix;
  });

  // Simple reordering by total co-occurrence sum (approximates clustering by grouping high-overlap genres)
  const orderedGenres = $derived.by(() => {
    if (genres.length === 0) return [];
    const sums = genres.map(g => {
      let sum = 0;
      genres.forEach(h => sum += coMatrix[g]?.[h] || 0);
      return sum;
    });
    const sortedIndices = sums.map((s, i) => i).sort((a, b) => sums[b] - sums[a]);
    return sortedIndices.map(i => genres[i]);
  });

  const colorScale = $derived.by(() => {
    const values = [];
    for (const row of Object.values(coMatrix)) {
      for (const val of Object.values(row)) {
        values.push(val);
      }
    }
    const maxVal = d3.max(values) || 1;
    return d3.scaleSequential(d3.interpolateReds)
      .domain([0, maxVal]);
  });

  $effect(() => {
    if (!svgElement || movies.length === 0 || orderedGenres.length === 0) return;

    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    const cellSize = Math.min((width - 100) / orderedGenres.length, 20);
    const plotHeight = orderedGenres.length * cellSize;
    const plotWidth = orderedGenres.length * cellSize;

    const margin = { top: 50, right: 50, bottom: 50, left: 120 };

    // Scales using ordered genres
    const xScale = d3.scaleBand()
      .domain(orderedGenres)
      .range([0, plotWidth])
      .padding(0);

    const yScale = d3.scaleBand()
      .domain(orderedGenres)
      .range([0, plotHeight])
      .padding(0);

    // Create plot group
    const plotG = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Draw cells using ordered genres
    orderedGenres.forEach(rowGenre => {
      orderedGenres.forEach(colGenre => {
        const value = coMatrix[rowGenre][colGenre];
        plotG.append("rect")
          .attr("x", xScale(colGenre)!)
          .attr("y", yScale(rowGenre)!)
          .attr("width", xScale.bandwidth())
          .attr("height", yScale.bandwidth())
          .attr("fill", colorScale(value))
          .attr("stroke", "white")
          .attr("stroke-width", 0.5)
          .append("title")
          .text(`${rowGenre} & ${colGenre}: ${value} movies`);
      });
    });

    // X axis
    const xAxisG = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top + plotHeight + 10})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("transform", "rotate(-45)");

    // Custom y-axis labels: positioned next to each row, horizontal for readability
    orderedGenres.forEach((genre, i) => {
      const labelX = margin.left - 10; // Position to the left of the plot
      const labelY = margin.top + yScale(genre)! + yScale.bandwidth() / 2;
      svg.append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-size", "10px")
        .style("fill", "black")
        .text(genre);
    });

    // Labels for diagonal (totals)
    orderedGenres.forEach(genre => {
      const midX = xScale(genre)! + xScale.bandwidth() / 2;
      const midY = yScale(genre)! + yScale.bandwidth() / 2;
      plotG.append("text")
        .attr("x", midX)
        .attr("y", midY)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "8px")
        .style("font-weight", "bold")
        .text(coMatrix[genre][genre].toString());
    });

    // Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Genre Co-Occurrence Heatmap (Diagonal: Total Movies per Genre, Sorted by Total Co-occurrences)");

    // Simple legend: discrete color swatches with labels
    const legendData = [
      { value: 0, label: "0" },
      { value: 100, label: "100" },
      { value: 200, label: "200" },
      { value: 300, label: "300" },
      { value: 400, label: "400" },
      { value: 500, label: "500+" }
    ];

    const legendG = svg.append("g")
      .attr("transform", `translate(${margin.left + plotWidth + 20}, ${margin.top})`);

    legendData.forEach((d, i) => {
      const yPos = i * 20;
      // Color swatch
      legendG.append("rect")
        .attr("x", 0)
        .attr("y", yPos)
        .attr("width", 20)
        .attr("height", 18)
        .attr("fill", colorScale(d.value));

      // Label
      legendG.append("text")
        .attr("x", 25)
        .attr("y", yPos + 13)
        .attr("text-anchor", "start")
        .style("font-size", "10px")
        .text(d.label);
    });

    // Legend title
    svg.append("text")
      .attr("x", margin.left + plotWidth + 20)
      .attr("y", margin.top - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Co-occurrences");
  });
</script>

<svg {width} {height} bind:this={svgElement}></svg>