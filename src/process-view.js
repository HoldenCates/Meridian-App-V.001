(function attachMeridianProcessView(root) {
  let chart = null;
  let observedContainer = null;

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const themeColor = (token, fallback) => root.getComputedStyle?.(root.document.documentElement).getPropertyValue(token).trim() || fallback;
  const edgeMetric = (edge, overlay) => overlay === "duration" ? edge.avgHours : overlay === "cost" ? edge.totalCost : edge.occurrences;
  const edgeDisplay = (edge, overlay) => overlay === "duration" ? `${edge.avgHours.toFixed(1)}h` : overlay === "cost" ? `$${edge.totalCost.toFixed(0)}` : `${edge.occurrences}`;

  function edgeColor(value, maximum, overlay) {
    if (overlay === "frequency") return themeColor("--chart-frequency", "#b88912");
    const ratio = maximum ? value / maximum : 0;
    if (overlay === "duration") return ratio > 0.65 ? themeColor("--chart-duration-high", "#b42318") : ratio > 0.35 ? themeColor("--chart-duration-mid", "#d58a0b") : themeColor("--chart-duration-low", "#c9a227");
    return ratio > 0.65 ? themeColor("--chart-cost-high", "#6f5200") : ratio > 0.35 ? themeColor("--chart-cost-mid", "#a77d09") : themeColor("--chart-cost-low", "#d4af37");
  }

  function render(container, graph, overlay, onSelect) {
    if (!root.echarts || !container || container.clientWidth === 0) return;
    if (!chart) chart = root.echarts.init(container, null, { renderer: "canvas" });
    if (observedContainer !== container && root.ResizeObserver) {
      observedContainer = container;
      new ResizeObserver(() => chart?.resize()).observe(container);
    }
    const maximumEdgeValue = Math.max(0, ...graph.edges.map(edge => edgeMetric(edge, overlay)));
    const maximumCases = Math.max(1, ...graph.nodes.map(node => node.cases));
    const dominantSet = new Set(graph.dominantPath);
    const nodes = graph.nodes.map((node, index) => ({
      ...node,
      x: 90 + node.order * 180,
      y: dominantSet.has(node.name) ? 150 : 245 + (index % 2) * 100,
      value: node.cases,
      symbol: "circle",
      symbolSize: 50 + 18 * (node.cases / maximumCases),
      itemStyle: { color: node.reworkOccurrences ? themeColor("--chart-node-rework", "#fff2c2") : themeColor("--chart-node", "#fffdf5"), borderColor: node.reworkOccurrences ? themeColor("--chart-node-rework-border", "#b26b00") : themeColor("--chart-node-border", "#b88912"), borderWidth: 2 },
      label: { color: themeColor("--chart-label", "#16140f"), fontSize: 10, fontWeight: 700, width: 100, overflow: "break", position: "bottom", distance: 8 }
    }));
    const links = graph.edges.map(edge => {
      const value = edgeMetric(edge, overlay);
      return {
        ...edge,
        value,
        displayValue: edgeDisplay(edge, overlay),
        lineStyle: {
          width: 1.5 + (maximumEdgeValue ? 6.5 * value / maximumEdgeValue : 0),
          color: edgeColor(value, maximumEdgeValue, overlay),
          curveness: edge.source === edge.target ? 0.55 : 0.08,
          opacity: 0.78
        }
      };
    });
    chart.setOption({
      animationDuration: 350,
      aria: { enabled: true, decal: { show: true }, description: `Process map for ${graph.orders} orders showing ${overlay}.` },
      tooltip: {
        trigger: "item",
        confine: true,
        formatter(params) {
          const data = params.data;
          if (params.dataType === "edge") return `<strong>${escapeHtml(data.source)} → ${escapeHtml(data.target)}</strong><br>${data.cases} orders · ${data.occurrences} transitions<br>${data.avgHours.toFixed(1)} average hours · $${data.totalCost.toFixed(2)} event cost`;
          return `<strong>${escapeHtml(data.name)}</strong><br>${data.cases} orders · ${data.occurrences} events<br>${data.reworkOccurrences} repeated events · $${data.totalCost.toFixed(2)} event cost`;
        }
      },
      series: [{
        type: "graph",
        layout: "none",
        roam: true,
        selectedMode: "single",
        data: nodes,
        links,
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: 8,
        label: { show: true },
        edgeLabel: { show: true, formatter: params => params.data.displayValue, color: themeColor("--chart-edge-label", "#403c32"), fontFamily: "IBM Plex Mono", fontSize: 10, backgroundColor: themeColor("--chart-edge-label-bg", "rgba(255,255,255,.9)"), padding: [2, 4], borderRadius: 3 },
        emphasis: { focus: "adjacency", lineStyle: { opacity: 1 } },
        select: { itemStyle: { borderColor: themeColor("--chart-selection", "#101828"), borderWidth: 3 }, lineStyle: { opacity: 1 } }
      }]
    }, true);
    chart.off("click");
    chart.on("click", params => {
      if (params.dataType === "node" || params.dataType === "edge") onSelect?.(params.dataType, params.data);
    });
    chart.resize();
  }

  function select(type, id, graph) {
    if (!chart) return;
    const collection = type === "edge" ? graph.edges : graph.nodes;
    const index = collection.findIndex(item => item.id === id);
    if (index < 0) return;
    chart.dispatchAction({ type: "select", seriesIndex: 0, dataType: type, dataIndex: index });
    chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataType: type, dataIndex: index });
  }

  root.MeridianProcessView = { render, select };
})(window);
