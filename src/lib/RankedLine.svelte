<!-- RankedLine.svelte -->
<script lang="ts">
  import type { TMovie } from "../types";
  import * as d3 from "d3";

  type Props = {
    movies: TMovie[];
    width?: number;
    height?: number;
  };

  let { movies, width = 800, height = 400 }: Props = $props();

  const margin = { top: 20, right: 80, bottom: 50, left: 50 };

  let svgElement: SVGSVGElement | null = null;

  // Derived values
  const genres = $derived.by(() => {
    const allGenres = new Set<string>();
    movies.forEach(m => m.genres.forEach(g => allGenres.add(g)));
    return Array.from(allGenres);
  });

  const colorScale = $derived.by(() => {
    return d3.scaleOrdinal(d3.schemeCategory10).domain(genres);
  });

  const processedData = $derived.by(() => {
    if (movies.length === 0) return { yearData: [], genreTrajectories: [], years: [] };
    const yearGroups = d3.group(movies, (d: TMovie) => d.year);
    const yearData = Array.from(yearGroups.entries())
      .map(([year, group]) => {
        const flatGenres = group.flatMap((m: TMovie) => m.genres);
        const genreCounts = d3.rollup(
          flatGenres,
          (values) => values.length,
          (genre) => genre
        );
        const counts = Array.from(genreCounts, ([genre, count]) => ({ genre, count: count as number }));
        const sorted = counts.sort((a, b) => b.count - a.count).slice(0, 3);
        return {
          year: year as number,
          top3: sorted.map((s, i) => ({ ...s, rank: i + 1 }))
        };
      })
      .sort((a, b) => a.year - b.year);

    // Build cumulative trajectories: start at 0, add rank bonus each year if in top 3
    const genreTrajectories: Array<{ year: number; cumulative: number }>[] = genres.map(genre => {
      let cumulative = 0;
      const trajectory: { year: number; cumulative: number }[] = [];
      yearData.forEach(yd => {
        const entry = yd.top3.find((t: any) => t.genre === genre);
        if (entry) {
          cumulative += (4 - entry.rank); // Rank 1: +3, Rank 2: +2, Rank 3: +1
        }
        trajectory.push({ year: yd.year, cumulative });
      });
      return trajectory;
    });

    const years = yearData.map(d => d.year);
    return { yearData, genreTrajectories, years };
  });

  const xScale = $derived.by(() => {
    const years = processedData.years;
    if (years.length === 0) return d3.scaleLinear().domain([1980, 2023]).range([margin.left, width - margin.right]);
    const minYear = d3.min(years) ?? 1980;
    const maxYear = d3.max(years) ?? 2023;
    return d3.scaleLinear()
      .domain([minYear, maxYear])
      .range([margin.left, width - margin.right]);
  });

  const yScale = $derived.by(() => {
    const allCumulatives = processedData.genreTrajectories.flatMap(t => t.map(p => p.cumulative));
    if (allCumulatives.length === 0) return d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
    const maxY = d3.max(allCumulatives) ?? 0;
    return d3.scaleLinear()
      .domain([0, Math.max(maxY, 1)])
      .range([height - margin.bottom, margin.top]);
  });

  $effect(() => {
    if (!svgElement || movies.length === 0 || processedData.yearData.length === 0) return;

    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    // Create axes first
    const xAxisG = svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`);
    
    const yAxisG = svg.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${margin.left}, 0)`);

    // Draw axes
    xAxisG.call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");
    
    yAxisG.call(d3.axisLeft(yScale));

    // Add y-axis label (shifted left)
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Cumulative Top 3 Rank Score");

    // Add x-axis label
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("fill", "black")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Year");

    // Create line generator with current scales
    const lineGenerator = d3.line<{ year: number; cumulative: number }>()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.cumulative))
      .curve(d3.curveLinear);

    const g = svg.append("g");

    // Draw lines
    processedData.genreTrajectories.forEach((trajectory, idx) => {
      if (trajectory.length > 0) {
        g.append("path")
          .datum(trajectory)
          .attr("d", lineGenerator(trajectory))
          .attr("fill", "none")
          .attr("stroke", colorScale(genres[idx]))
          .attr("stroke-width", 2);
      }
    });

    // Draw points
    processedData.genreTrajectories.forEach((trajectory, idx) => {
      g.selectAll(`.point-${idx}`)
        .data(trajectory)
        .enter()
        .append("circle")
        .attr("class", `point-${idx}`)
        .attr("cx", (d: any) => xScale(d.year))
        .attr("cy", (d: any) => yScale(d.cumulative))
        .attr("r", 2)
        .attr("fill", colorScale(genres[idx]));
    });

    // Labels on last point - only show top genres with significant scores
    const labelData = processedData.genreTrajectories
      .map((trajectory, idx) => {
        if (trajectory.length === 0) return null;
        const last = trajectory[trajectory.length - 1];
        return {
          genre: genres[idx],
          lineX: xScale(last.year),
          lineY: yScale(last.cumulative),
          cumulative: last.cumulative,
          color: colorScale(genres[idx])
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.cumulative - a.cumulative);

    // Only label the top 8 genres or those with score > 5
    const threshold = Math.max(5, labelData[Math.min(7, labelData.length - 1)]?.cumulative || 0);
    const significantLabels = labelData.filter(d => d.cumulative >= threshold);
    
    // Sort by y position for spacing adjustment
    significantLabels.sort((a, b) => a.lineY - b.lineY);

    // Adjust y positions to prevent overlap
    const minSpacing = 12;
    significantLabels.forEach((d, i) => {
      if (i === 0) {
        d.labelY = d.lineY;
      } else {
        d.labelY = Math.max(d.lineY, significantLabels[i - 1].labelY! + minSpacing);
      }
    });

    // Draw connector lines from line end to label
    significantLabels.forEach(d => {
      const labelX = d.lineX + 5;
      
      g.append("line")
        .attr("x1", d.lineX)
        .attr("y1", d.lineY)
        .attr("x2", labelX - 2)
        .attr("y2", d.labelY!)
        .attr("stroke", d.color)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "2,2");
    });

    // Draw labels with adjusted positions
    significantLabels.forEach(d => {
      g.append("text")
        .attr("x", d.lineX + 5)
        .attr("y", d.labelY!)
        .attr("dy", "0.35em")
        .text(d.genre)
        .attr("fill", d.color)
        .style("font-size", "10px");
    });
  });
</script>

<svg {width} {height} bind:this={svgElement}></svg>

<style>
  :global(.x-axis text) {
    text-anchor: end;
  }
</style>