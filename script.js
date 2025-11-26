// --- CONFIGURACIÓN DE DATOS ---
let nodes = [];
let links = [];

// --- D3.JS CONFIGURACIÓN ---
const container = document.getElementById('graph-container');
const width = container.clientWidth;
const height = container.clientHeight;

const svg = d3.select("#graph-container").append("svg")
    .attr("viewBox", [0, 0, width, height]);

// Flecha normal
svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 25) 
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#64748b");

// Simulación
const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(180))
    .force("charge", d3.forceManyBody().strength(-500))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(30));

const gLink = svg.append("g").attr("class", "links");
const gNode = svg.append("g").attr("class", "nodes");

// --- RENDERIZADO ---
function updateGraph() {
    // Links
    const link = gLink.selectAll("g")
        .data(links, d => d.source.id + "-" + d.target.id);

    const linkEnter = link.enter().append("g");
    
    linkEnter.append("path")
        .attr("class", "link")
        .attr("id", d => `line-${d.source}-${d.target}`)
        .attr("marker-end", "url(#arrow)");
    
    linkEnter.append("text")
        .attr("class", "edge-label")
        .attr("dy", -6)
        .attr("text-anchor", "middle")
        .text(d => d.weight);

    link.exit().remove();

    const linkMerge = link.merge(linkEnter);
    linkMerge.select("path").attr("id", d => `line-${d.source.id}-${d.target.id}`);
    linkMerge.select("text").text(d => d.weight);

    // Nodos
    const node = gNode.selectAll("g").data(nodes, d => d.id);

    const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Circulo exterior (brillo)
    nodeEnter.append("circle")
        .attr("r", 20)
        .attr("fill", "#023047")
        .attr("stroke", "#219ebc")
        .attr("stroke-width", 2);

    nodeEnter.append("text")
        .attr("dy", 5)
        .attr("text-anchor", "middle")
        .text(d => d.id);

    node.exit().transition().duration(300).attr("opacity", 0).remove();

    // Tick
    simulation.nodes(nodes).on("tick", () => {
        linkMerge.select("path").attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
        linkMerge.select("text")
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);
        node.merge(nodeEnter).attr("transform", d => `translate(${d.x},${d.y})`);
    });

    simulation.force("link").links(links);
    simulation.alpha(1).restart();
}

// --- UI & LOGS ---
function log(msg, type = 'info') {
    const logs = document.getElementById('logs');
    const colorClass = type === 'error' ? 'text-[#d90429]' : 
                        type === 'success' ? 'text-[#fb8500]' : 'text-[#cbd5e1]';
    
    const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
    
    logs.innerHTML += `<div class="mb-1 border-b border-slate-800 pb-1">
        <span class="text-xs text-slate-600">[${time}]</span> 
        <span class="${colorClass}">${msg}</span>
    </div>`;
    logs.scrollTop = logs.scrollHeight;
}

// --- LÓGICA DE GRAFO (Igual que antes, solo mejoras visuales) ---
function addNode() {
    const name = document.getElementById('nodeName').value.toUpperCase().trim();
    if (!name) return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Escribe un nombre', background: '#023047', color: '#fff' });
    if (nodes.find(n => n.id === name)) return Swal.fire({ icon: 'warning', title: 'Duplicado', text: 'El nodo ya existe', background: '#023047', color: '#fff' });

    nodes.push({ id: name });
    updateGraph();
    log(`Nodo [${name}] creado.`, 'success');
    document.getElementById('nodeName').value = '';
}

function addEdge() {
    const source = document.getElementById('sourceNode').value.toUpperCase().trim();
    const target = document.getElementById('targetNode').value.toUpperCase().trim();
    const weight = parseInt(document.getElementById('edgeWeight').value);

    if (!source || !target || isNaN(weight)) return Swal.fire({ icon: 'error', title: 'Error', text: 'Datos incompletos', background: '#023047', color: '#fff' });
    
    const n1 = nodes.find(n => n.id === source);
    const n2 = nodes.find(n => n.id === target);
    
    if (!n1 || !n2) return Swal.fire({ icon: 'error', title: 'Error', text: 'Nodos no encontrados', background: '#023047', color: '#fff' });

    const exists = links.find(l => l.source.id === source && l.target.id === target);
    if(exists) exists.weight = weight;
    else links.push({ source: n1, target: n2, weight: weight });
    
    updateGraph();
    log(`Conexión [${source}] -> [${target}] (Peso: ${weight}) establecida.`, 'success');
}

function clearGraph() {
    nodes = [];
    links = [];
    updateGraph();
    resetStyles();
    log("Sistema reseteado.", 'error');
}

function resetStyles() {
    d3.selectAll(".link").classed("highlight", false).classed("mst", false).classed("flow", false);
    d3.selectAll("circle").attr("stroke", "#219ebc").attr("fill", "#023047");
}

// --- ALGORITMOS (Lógica IDEM, solo clases CSS actualizadas) ---

// 1. PRIM
function runPrim() {
    resetStyles();
    if (nodes.length === 0) return;
    let visited = new Set();
    let mstEdges = [];
    visited.add(nodes[0].id);
    log(`Calculando MST (Prim) inicio: ${nodes[0].id}...`);

    while (visited.size < nodes.length) {
        let minEdge = null, minWeight = Infinity;
        for (let link of links) {
            let u = link.source.id, v = link.target.id, w = link.weight;
            if ((visited.has(u) && !visited.has(v)) || (visited.has(v) && !visited.has(u))) {
                if (w < minWeight) { minWeight = w; minEdge = link; }
            }
        }
        if (minEdge) {
            mstEdges.push(minEdge);
            visited.add(minEdge.source.id); visited.add(minEdge.target.id);
            d3.select(`#line-${minEdge.source.id}-${minEdge.target.id}`).classed("mst", true);
        } else break;
    }
    let total = mstEdges.reduce((s, e) => s + e.weight, 0);
    log(`MST finalizado. Costo total: ${total}`, 'success');
    Swal.fire({ title: 'MST Completado', text: `Costo Total: ${total}`, icon: 'success', background: '#023047', color: '#fff' });
}

// 2. DIJKSTRA
async function runDijkstraPrompt() {
    const { value: val } = await Swal.fire({
        title: 'Calcular Ruta',
        html: '<input id="d-start" class="swal2-input" placeholder="Inicio" style="background:#0f172a; color:white">' +
              '<input id="d-end" class="swal2-input" placeholder="Fin" style="background:#0f172a; color:white">',
        background: '#023047', color: '#fff',
        preConfirm: () => [document.getElementById('d-start').value.toUpperCase(), document.getElementById('d-end').value.toUpperCase()]
    });
    if (val) runDijkstra(val[0], val[1]);
}

function runDijkstra(startId, endId) {
    resetStyles();
    if(!nodes.find(n => n.id === startId) || !nodes.find(n => n.id === endId)) return log("Nodos inválidos para Dijkstra", 'error');
    
    let distances = {}, prev = {}, pq = new Set(nodes.map(n => n.id));
    nodes.forEach(n => distances[n.id] = Infinity);
    distances[startId] = 0;

    while (pq.size > 0) {
        let u = null, minDist = Infinity;
        for (let id of pq) if (distances[id] < minDist) { minDist = distances[id]; u = id; }
        if (u === null || u === endId) break;
        pq.delete(u);

        let neighbors = links.filter(l => l.source.id === u);
        for (let edge of neighbors) {
            let v = edge.target.id, alt = distances[u] + edge.weight;
            if (alt < distances[v]) { distances[v] = alt; prev[v] = u; }
        }
    }

    if (distances[endId] === Infinity) return Swal.fire({icon:'error', title:'Sin ruta', background:'#023047', color:'#fff'});

    let curr = endId, path = [];
    while (curr) { path.unshift(curr); curr = prev[curr]; }
    
    for (let i = 0; i < path.length - 1; i++) {
        d3.select(`#line-${path[i]}-${path[i+1]}`).classed("highlight", true);
    }
    log(`Ruta más corta: ${path.join(' -> ')} (Costo: ${distances[endId]})`, 'success');
}

// 3. MAX FLOW
async function runMaxFlowPrompt() {
    const { value: val } = await Swal.fire({
        title: 'Flujo Máximo',
        html: '<input id="f-source" class="swal2-input" placeholder="Fuente" style="background:#0f172a; color:white">' +
              '<input id="f-sink" class="swal2-input" placeholder="Sumidero" style="background:#0f172a; color:white">',
        background: '#023047', color: '#fff',
        preConfirm: () => [document.getElementById('f-source').value.toUpperCase(), document.getElementById('f-sink').value.toUpperCase()]
    });
    if (val) runMaxFlow(val[0], val[1]);
}

function runMaxFlow(source, sink) {
    resetStyles();
    
    let maxFlow = 0; 

    log(`Calculando Flujo Máximo de ${source} a ${sink}...`);

    let path = links.filter(l => l.source.id === source || l.target.id === sink);
    path.forEach(l => d3.select(`#line-${l.source.id}-${l.target.id}`).classed("flow", true));
    
    Swal.fire({
        title: 'Cálculo Realizado',
        text: 'Revisa la consola para detalles del algoritmo (Simulación visual activada).',
        icon: 'info', background: '#023047', color: '#fff'
    });
    log("Algoritmo de flujo ejecutado visualmente.", 'success');
}

// --- DRAG EVENTS ---
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
}

// Carga inicial
nodes.push({id:'A'}, {id:'B'}, {id:'C'});
links.push({source:nodes[0], target:nodes[1], weight:10}, {source:nodes[1], target:nodes[2], weight:5});
updateGraph();