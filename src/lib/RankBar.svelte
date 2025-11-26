<script lang="ts">
  import { fade } from "svelte/transition";
  import * as d3 from "d3";

  type Datum = { genre: string; count: number };
  type Props = {
    data: Datum[];
    progress?: number;
    width?: number;
    height?: number;
  };
  let { data = [], progress = 100, width = 300, height = 400 }: Props = $props();

  const ranked = $derived(
    [...data].sort((a, b) => b.count - a.count)
  );

  const margin = { top: 20, right: 20, bottom: 40, left: 80 };
  const innerWidth = $derived(width - margin.left - margin.right);
  const innerHeight = $derived(height - margin.top - margin.bottom);

  const barHeight = 22;
  const gap = 4;
  const totalHeight = $derived(ranked.length * (barHeight + gap));

  const y = $derived(
    d3.scaleBand()
      .domain(ranked.map(d => d.genre))
      .range([0, Math.max(innerHeight, totalHeight)])
      .paddingInner(0.1)
  );

  const x = $derived(
    d3.scaleLinear()
      .domain([0, d3.max(ranked, d => d.count) ?? 0])
      .range([0, innerWidth])
  );

  // -----------------------------------------------------------------
  // D3 drawing – runs on every reactive change
  // -----------------------------------------------------------------
  let g: SVGGElement;
  $effect(() => {
    if (g) draw(ranked);
  });

  function draw(data: Datum[]) {
    const svg = d3.select(g)
      .attr("width", width)
      .attr("height", height);

    const chart = svg.selectAll<SVGGElement, unknown>(".chart")
      .data([null])
      .join("g")
      .attr("class", "chart")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xAxis = d3.axisBottom(x).ticks(5);
    svg.select<SVGGElement>(".x-axis")
      .attr("transform", `translate(${margin.left},${height - margin.bottom})`)
      .call(xAxis);

    const bars = chart.selectAll<SVGGElement, Datum>("g.bar")
      .data(data, d => d.genre);

    // ===== ENTER: New bars (initially hidden) =====
    const enter = bars.enter()
      .append("g")
      .attr("class", "bar")
      .attr("opacity", 0)
      .attr("transform", d => `translate(0,${y(d.genre)!})`);

    enter.append("rect")
      .attr("height", barHeight)
      .attr("fill", "#449900")
      .attr("x", 0)
      .attr("width", 0);

    enter.append("text")
      .attr("class", "label")
      .attr("dy", "0.35em")
      .attr("x", -6)
      .attr("text-anchor", "end")
      .text(d => d.genre);

    enter.append("text")
      .attr("class", "value")
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("x", 4);

    // ===== UPDATE: Existing bars animate FIRST (600ms) =====
    bars.transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr("transform", d => `translate(0,${y(d.genre)!})`)
      .attr("opacity", 1);

    bars.select<SVGRectElement>("rect")
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr("width", d => x(d.count));

    bars.select<SVGTextElement>("text.value")
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr("x", d => x(d.count) + 4)
      .tween("text", function (d) {
        const currentText = d3.select(this).text();
        const currentValue = currentText ? +currentText : 0;
        const i = d3.interpolateRound(currentValue, d.count);
        return t => d3.select(this).text(`${i(t)}`);
      });

    // ===== ENTER transitions: New bars fade in AFTER existing bars (delay 600ms) =====
    enter.transition()
      .delay(600)
      .duration(400)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1);

    enter.select<SVGRectElement>("rect")
      .transition()
      .delay(600)
      .duration(400)
      .ease(d3.easeCubicOut)
      .attr("width", d => x(d.count));

    enter.select<SVGTextElement>("text.value")
      .transition()
      .delay(600)
      .duration(400)
      .ease(d3.easeCubicOut)
      .attr("x", d => x(d.count) + 4)
      .tween("text", function (d) {
        const i = d3.interpolateRound(0, d.count);
        return t => d3.select(this).text(`${i(t)}`);
      });

    // ===== EXIT: Bars that are removed fade out =====
    bars.exit()
      .transition()
      .duration(300)
      .attr("opacity", 0)
      .remove();
  }
</script>

<svg bind:this={g}>
  <g class="x-axis"></g>
</svg>

<style>
  .bar rect { transition: fill 0.2s; }
  .bar:hover rect { fill: #ff8800; }
  text { font-family: system-ui, sans-serif; font-size: 12px; }
  text.label { fill: #333; }
  text.value { fill: #111; font-weight: 600; }
</style>