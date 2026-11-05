(function attachMeridianProcessView(root) {
  let chart = null;
  let observedContainer = null;
  let lastProjection = null;

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const themeColor = (token, fallback) => root.getComputedStyle?.(root.document?.documentElement).getPropertyValue(token).trim() || fallback;
  const edgeMetric = (edge, overlay) => overlay === "duration" ? edge.avgHours : overlay === "cost" ? edge.totalCost : edge.occurrences;
  const edgeDisplay = (edge, overlay) => overlay === "duration" ? `${edge.avgHours.toFixed(1)}h` : overlay === "cost" ? `$${edge.totalCost.toFixed(0)}` : `${edge.occurrences}`;
  const edgeId = (source, target) => `${source}|||${target}`;
  const wrapActivityName = (name, compact) => {
    if (!compact || !name.includes(" ")) return name;
    const words = name.split(" ");
    const midpoint = Math.ceil(words.length / 2);
    return `${words.slice(0, midpoint).join(" ")}\n${words.slice(midpoint).join(" ")}`;
  };

  function nodeDimensions(container, projection) {
    const backboneCount = Math.max(2, projection.dominantPath.length);
    const estimatedCenterGap = Math.max(120, (container.clientWidth - 88) / (backboneCount - 1));
    const width = Math.round(Math.min(150, Math.max(90, estimatedCenterGap - 34)));
    return { width, height: width < 132 ? 74 : 64, compact: width < 132 };
  }

  function project(graph, mode = "exceptions", bottleneckTargetHours = 2) {
    const detailMode = ["core", "exceptions", "full"].includes(mode) ? mode : "exceptions";
    const waitTargetHours = Math.max(0, Number(bottleneckTargetHours) || 0);
    const coreEdgeIds = new Set(graph.dominantPath.slice(0, -1).map((source, index) => edgeId(source, graph.dominantPath[index + 1])));
    const bottleneckIds = new Set([...graph.edges]
      .filter(edge => edge.source !== edge.target && edge.avgHours > waitTargetHours)
      .sort((left, right) => right.avgHours - left.avgHours)
      .slice(0, Math.min(2, graph.edges.length))
      .map(edge => edge.id));
    const nonCoreEdges = graph.edges.filter(edge => !coreEdgeIds.has(edge.id));
    const exceptionIds = new Set([
      ...nonCoreEdges.filter(edge => edge.source === edge.target).map(edge => edge.id),
      ...[...nonCoreEdges].sort((left, right) => right.avgHours - left.avgHours || right.occurrences - left.occurrences).slice(0, 4).map(edge => edge.id)
    ]);
    const edges = graph.edges.filter(edge => detailMode === "full" || coreEdgeIds.has(edge.id) || (detailMode === "exceptions" && exceptionIds.has(edge.id)));
    const visibleNodeIds = new Set(graph.dominantPath);
    edges.forEach(edge => { visibleNodeIds.add(edge.source); visibleNodeIds.add(edge.target); });
    const nodes = graph.nodes.filter(node => visibleNodeIds.has(node.id));
    const caseIds = new Set(edges.flatMap(edge => edge.caseIds));
    return {
      ...graph,
      nodes,
      edges,
      detailMode,
      coreEdgeIds,
      bottleneckIds,
      exceptionIds,
      waitTargetHours,
      coverage: {
        activities: nodes.length,
        totalActivities: graph.nodes.length,
        connections: edges.length,
        totalConnections: graph.edges.length,
        orders: caseIds.size,
        totalOrders: graph.orders
      }
    };
  }

  function edgeColor(edge, value, maximum, overlay, projection) {
    if (projection.bottleneckIds.has(edge.id)) return themeColor("--chart-duration-high", "#b42318");
    if (overlay === "frequency") return projection.coreEdgeIds.has(edge.id) ? themeColor("--chart-frequency", "#b88912") : themeColor("--chart-secondary-edge", "#5f625f");
    const ratio = maximum ? value / maximum : 0;
    if (overlay === "duration") return ratio > 0.65 ? themeColor("--chart-duration-high", "#b42318") : ratio > 0.35 ? themeColor("--chart-duration-mid", "#d58a0b") : themeColor("--chart-duration-low", "#c9a227");
    return ratio > 0.65 ? themeColor("--chart-cost-high", "#6f5200") : ratio > 0.35 ? themeColor("--chart-cost-mid", "#a77d09") : themeColor("--chart-cost-low", "#d4af37");
  }

  function nodePosition(node, index, projection) {
    const backboneIndex = new Map(projection.dominantPath.map((name, pathIndex) => [name, pathIndex]));
    if (backboneIndex.has(node.name)) return { x: 110 + backboneIndex.get(node.name) * 230, y: 220 };
    const anchors = projection.edges.flatMap(edge => {
      if (edge.source === node.name && backboneIndex.has(edge.target)) return [backboneIndex.get(edge.target) - 0.45];
      if (edge.target === node.name && backboneIndex.has(edge.source)) return [backboneIndex.get(edge.source) + 0.45];
      return [];
    });
    const level = anchors.length ? anchors.reduce((sum, value) => sum + value, 0) / anchors.length : Math.min(node.order, Math.max(0, projection.dominantPath.length - 1));
    const exceptionIndex = projection.nodes.filter(item => !backboneIndex.has(item.name)).findIndex(item => item.id === node.id);
    return { x: 110 + level * 230, y: exceptionIndex % 2 ? 360 : 80 + (index % 2) * 16 };
  }

  function render(container, graph, overlay, detailMode, bottleneckTargetHours, onSelect) {
    const projection = project(graph, detailMode, bottleneckTargetHours);
    lastProjection = projection;
    if (!root.echarts || !container || container.clientWidth === 0) return projection;
    if (!chart) chart = root.echarts.init(container, null, { renderer: "canvas" });
    if (observedContainer !== container && root.ResizeObserver) {
      observedContainer = container;
      new ResizeObserver(() => chart?.resize()).observe(container);
    }
    const maximumEdgeValue = Math.max(0, ...projection.edges.map(edge => edgeMetric(edge, overlay)));
    const bottleneckNodes = new Set(projection.edges.filter(edge => projection.bottleneckIds.has(edge.id)).flatMap(edge => [edge.source, edge.target]));
    const dimensions = nodeDimensions(container, projection);
    const nodes = projection.nodes.map((node, index) => {
      const position = nodePosition(node, index, projection);
      const isBackbone = projection.dominantPath.includes(node.name);
      const isBottleneck = bottleneckNodes.has(node.name);
      const isTerminal = node.name === projection.dominantPath[0] || node.name === projection.dominantPath.at(-1);
      return {
        ...node,
        ...position,
        value: node.cases,
        symbol: "rect",
        symbolSize: [dimensions.width, dimensions.height],
        itemStyle: {
          color: node.reworkOccurrences ? themeColor("--chart-node-rework", "#fff2c2") : themeColor("--chart-node", "#fffdf5"),
          borderColor: isBottleneck ? themeColor("--chart-duration-high", "#b42318") : node.reworkOccurrences ? themeColor("--chart-node-rework-border", "#b26b00") : themeColor("--chart-node-border", "#b88912"),
          borderWidth: isTerminal ? 3 : isBackbone ? 2 : 1,
          shadowBlur: isBottleneck ? 18 : isBackbone ? 9 : 0,
          shadowColor: isBottleneck ? themeColor("--chart-bottleneck-halo", "rgba(180,35,24,.38)") : themeColor("--chart-backbone-halo", "rgba(212,175,55,.18)")
        },
        label: {
          show: true,
          position: "inside",
          formatter: params => `{name|${wrapActivityName(params.data.name, dimensions.compact)}}\n{metric|${params.data.cases} ORDERS${params.data.reworkOccurrences ? ` · ${params.data.reworkOccurrences} REPEAT` : ""}}`,
          rich: {
            name: { color: themeColor("--chart-label", "#16140f"), fontFamily: "IBM Plex Mono", fontSize: dimensions.compact ? 11 : 12, fontWeight: 600, width: dimensions.width - 14, overflow: "truncate", lineHeight: dimensions.compact ? 15 : 19, align: "center" },
            metric: { color: isBottleneck ? themeColor("--chart-duration-high", "#b42318") : themeColor("--chart-node-metric", "#a99a72"), fontFamily: "IBM Plex Mono", fontSize: 9, width: dimensions.width - 14, lineHeight: 14, align: "center" }
          }
        }
      };
    });
    const links = projection.edges.map((edge, index) => {
      const value = edgeMetric(edge, overlay);
      const isCore = projection.coreEdgeIds.has(edge.id);
      return {
        ...edge,
        value,
        displayValue: edgeDisplay(edge, overlay),
        lineStyle: {
          width: 1.5 + (maximumEdgeValue ? 5.5 * value / maximumEdgeValue : 0),
          color: edgeColor(edge, value, maximumEdgeValue, overlay, projection),
          curveness: edge.source === edge.target ? 0.55 : isCore ? 0 : index % 2 ? 0.14 : -0.14,
          opacity: isCore || projection.bottleneckIds.has(edge.id) ? 0.95 : 0.58,
          shadowBlur: projection.bottleneckIds.has(edge.id) ? 10 : 0,
          shadowColor: themeColor("--chart-bottleneck-halo", "rgba(180,35,24,.38)")
        }
      };
    });
    chart.setOption({
      animationDuration: 280,
      aria: { enabled: true, decal: { show: true }, description: `Process map for ${projection.orders} orders showing ${projection.detailMode} detail and ${overlay}.` },
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
        zoom: 1,
        selectedMode: "single",
        data: nodes,
        links,
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: 9,
        label: { show: true },
        edgeLabel: { show: projection.detailMode !== "full", formatter: params => params.data.displayValue, color: themeColor("--chart-edge-label", "#403c32"), fontFamily: "IBM Plex Mono", fontSize: 9, backgroundColor: themeColor("--chart-edge-label-bg", "rgba(255,255,255,.9)"), padding: [3, 5], borderRadius: 0 },
        emphasis: { focus: "adjacency", lineStyle: { opacity: 1 } },
        select: { itemStyle: { borderColor: themeColor("--chart-selection", "#101828"), borderWidth: 3 }, lineStyle: { opacity: 1, width: 7 } }
      }]
    }, true);
    chart.off("click");
    chart.on("click", params => {
      if (params.dataType === "node" || params.dataType === "edge") onSelect?.(params.dataType, params.data);
    });
    chart.resize();
    return projection;
  }

  function select(type, id) {
    if (!chart || !lastProjection) return;
    const collection = type === "edge" ? lastProjection.edges : lastProjection.nodes;
    const index = collection.findIndex(item => item.id === id);
    if (index < 0) return;
    chart.dispatchAction({ type: "unselect", seriesIndex: 0 });
    chart.dispatchAction({ type: "select", seriesIndex: 0, dataType: type, dataIndex: index });
    chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataType: type, dataIndex: index });
  }

  function fit() {
    if (!chart) return;
    chart.setOption({ series: [{ zoom: 1, center: null }] });
    chart.resize();
  }

  const api = { project, render, select, fit };
  root.MeridianProcessView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
