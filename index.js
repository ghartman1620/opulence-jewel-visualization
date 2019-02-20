// Reference: https://bl.ocks.org/mbostock/3887051
;
let svg = d3.select("#dps")
let svg2 = d3.select("#dps-by-target");
let margin = {top: 20, right: 500, bottom: 150, left: 300};
let margin2 = margin;
let width = /* + to cast to number */ +svg.attr("width") - margin.left - margin.right;
let height = +svg.attr("height") - margin.bottom - margin.top;
let width2 = +svg2.attr("width") - margin2.left - margin2.right;
let height2 = +svg2.attr("height") - margin2.bottom - margin2.top;


// **************************************************************
// Scale, Group, & SVG for first bar chart (overall dps by jewel)
// **************************************************************

// grab a nice group to put all our stuff in 
let g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

// A scale for each of the groups. 
// Each spec will have its own group so the domain will be the specs.
let groupX = d3.scaleBand()
    .rangeRound([0, width])
    .paddingInner(.23); // make the groups not run into one another

// within each group we also have a scale, its domain will 
// be the jewels to go within each group
let withinGroupX = d3.scaleBand().padding(0.06);

// The height of the bars. This will be average dps of each spec with a 
// particular jewel

let y = d3.scaleLinear().rangeRound([height, 0]);

let z = d3.scaleOrdinal().range([
//    "#E8D93E", "#5DC161", "#2C4C41", "#EE3441"
    "#778899", "#319177",  "#8B0000", "#c77500",
]);

// **************************************************************
// Scale, Group, & SVG for first bar chart (overall dps by jewel)
// **************************************************************


let g2 = svg2.append("g").attr("transform", `translate(${margin2.left}, ${margin2.top})`);

// A scale for each of the groups. 
// Each spec will have its own group so the domain will be the specs.
let groupX2 = d3.scaleBand()
    .rangeRound([0, width2])
    .paddingInner(.2); // make the groups not run into one another

// within each group we also have a scale, its domain will 
// be the jewels to go within each group
let withinGroupX2 = d3.scaleBand().padding(0.03);

// The height of the bars. This will be average dps of each spec with a 
// particular jewel

let y2 = d3.scaleLinear().rangeRound([height, 0]);

let z2 = d3.scaleOrdinal().range([
//    "#E8D93E", "#5DC161", "#2C4C41", "#EE3441"
    "#c77500", "#319177", "#778899", "#8B0000"
]);

let targetZ = d3.scaleOrdinal().range([
    "#e41a1c", "#377eb8", "#4daf4a", "#984ea3"
])


// Tanks have no selection, and I'm not as interested in healer dps, becuase
// they have to split their jewel selection 50/50 anyway to get the shadow resist buff
// and put dps buffs on everybody.
tanks = [
    "DeathKnight-Blood",
    "DemonHunter-Vengeance",
    "Druid-Guardian",
    "Monk-Brewmaster",
    "Paladin-Protection",
    "Warrior-Protection"
]
healers = [
    "Monk-Mistweaver",
    "Paladin-Holy",
    "Priest-Holy",
    "Shaman-Restoration",
    "Priest-Discipline",
    "Druid-Restoration",
    "Monk" // Apparently somewhere there's a fucking Monk with no spec. The fuck?
            // Well we won't count them because they had a Tailwind Sapphire.
]
// this to avoid picking up dps to strange random things that sometimes crop up in the logs,
// especially critters.
let targets = [
    "Opulence",
    "Spirit of Gold",
    "The Hand of In'zashi",
    "Yalat's Bulwark"
];

d3.json("rankingsbytarget_progress2.json", (data) => {
    for(let tank of tanks){
        delete data[tank];
    }
    for(let healer of healers){
        delete data[healer];
    }
    
    // collect all the jewels for our group domain and for computing the aggregate
    // dps for each jewel
    let jewels = new Set();
    Object.keys(data).forEach((key) => {
        Object.keys(data[key]).forEach((jewel) => {
            if(!jewels.has(jewel)){
                jewels.add(jewel);
            }
        });
    })
    jewels = Array.from(jewels)
    
    // create aggregate sum 
    data["Total"] = {}
    jewels.forEach((jewel) => {
        Object.keys(data).forEach((key) => {
            if (data[key][jewel] === undefined)
                data[key][jewel] = {count: 0, sum: 0};
        })
        data["Total"][jewel] = {
            count: d3.sum(Object.keys(data), (key) => data[key][jewel].count),
            dps_sum: d3.sum(Object.keys(data), (key) => data[key][jewel].dps_sum),
        }
        for(let target of targets){
            data["Total"][jewel][target] = d3.sum(Object.keys(data), (key) => data[key][jewel][target]);
        }
    })
    // sort alphabetically, except "Total", which belongs first.
    groupX.domain(Object.keys(data).sort((a, b) => {
        if(a === "Total") return -1;
        if(b === "Total") return 1;
        return a.localeCompare(b);
    }));
    
    withinGroupX.domain(jewels).rangeRound([0, groupX.bandwidth()]);
    // domain of y scale is maximum average dps
    // for each spec
    y.domain([0, d3.max(Object.keys(data), (key) => {
        // return the maximum average dps by jewel
        return d3.max(Object.keys(data[key]), (jewel) => {
            return data[key][jewel].dps_sum/data[key][jewel].count;
        })
    })])
    // make a group (for the grouped bar chart) for each spec
    g.append("g")
        .selectAll("g")
        .data(Object.keys(data))
        .enter()
        .append("g")
        .attr("transform", (d) => `translate( ${groupX(d)}, 0)`)
        // for each spec, make a rect for each of the jewels
        .selectAll("rect")
        .data((d) => Object.entries(data[d]))
        .enter().append("rect")
            .attr("x", (d) => withinGroupX(d[0]))
            .attr("y", (d) => y(d[1].dps_sum/d[1].count))
            .attr("height", (d) => d[1].count !== 0 ? 
                    height - y(d[1].dps_sum/d[1].count)
                    : 0)
            .attr("width", withinGroupX.bandwidth())
            .attr("fill", (d) => z(d[0]));
    let legendYScale = d3.scaleBand().domain(jewels).rangeRound([0, 250]);
    let legend = svg.append("g").attr("transform", `translate(${width+margin.left}, ${height - 400})`);
    const LEGEND_SQUARE_SIZE = 20;
    legend.selectAll("g")
        .data(jewels)
        .enter()
        .append("g")
        .append("rect")
        .attr("fill", (d) => z(d))
        .attr("width", LEGEND_SQUARE_SIZE)
        .attr("height", LEGEND_SQUARE_SIZE)
        .attr("y", (d) => legendYScale(d))
    legend.selectAll("g")
        .append("text")
        .attr("y", (d) => legendYScale(d)+LEGEND_SQUARE_SIZE*3/4)
        .attr("x", (d) => LEGEND_SQUARE_SIZE+3)
        .attr("font-size", 14)
        .text((d) => d);
    g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(groupX))
        // rotated text from https://bl.ocks.org/mbostock/4403522
        .selectAll("text")
        .attr("transform", "rotate(60)")
        .attr("x", 9)
        .attr("dy", ".1em")
        .attr("font-size", 14)
        .style("text-anchor", "start")
    g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y));
    g.append("text")   
        .attr("transform", `translate(${-margin.left/6}, ${height/2}) rotate(270)`)
        .text("DPS")
    
    
    // Bar chart 2
    
    // Re-arrange the data so we have a list of spec/jewel combinations to make a group bar chart
    // for.
    // this will contain a list of spec-jewel combinations with their dps to each target,
    // a list containing objects of the form:
    // {
    //  spec: "Class-Spec",
    //  jewel: "jewel string",
    //  target1: number,
    //  target2: number,
    //  etc.
    // }
    // We're more or less just flattening data for the second bar chart
    // which will be grouped by target dps
    let data_byjewel = []
    
    for (let spec of Object.keys(data)){
        
        for(let jewel of jewels){
            let obj = {
                name: spec,
                jewel
            };
            // uniquely identifying string for domains of scales
            obj.id = obj.name + "-" + jewel
            // get allt he dps by target into this new list
            for(let key of Object.keys(data[spec][jewel])){obj[key] = data[spec][jewel][key]}
            data_byjewel.push(obj);
        }
    }
    
    
    
    
    
    
    // Let's just not count any specs that haven't at least hit every target.
    // Who plays those, anyway...4
    // sub rogue lul
    let i = 0;
    for(let spec of data_byjewel){
        for(let target of targets){
            if (spec[target] === undefined){
                data_byjewel.splice(i, 1);
                --i;
            }
        }
        ++i;
    }
    // jewels to show on the by target dps chart(for now)
    let currentJewels = [
        "Emerald of Earthen Roots",
        "Opal of Unleashed Rage"
    ]
    data_byjewel = data_byjewel.filter(d => d.name === "Total");
    
    groupX2.domain(data_byjewel.map(x => x.id));
    withinGroupX2.domain(targets).rangeRound([0, groupX2.bandwidth()]);
    y2.domain([0, d3.max(data_byjewel, (d) => {
        return d3.max(targets, (t) => d[t]/d.count);
    })]);
    
    g2.append("g")
        .selectAll("g")
        .data(data_byjewel)
        .enter()
        .append("g")
        .attr("transform", (d) => `translate( ${groupX2(d.id)}, 0)`)
        // for each spec, make a rect for each of the jewels
        .selectAll("rect")
        .data((d) => {
            let datum = [];
            for(let target of targets){
                datum.push({target, dps: d[target]/d.count});
            }
            return datum;
        })
        .enter().append("rect")
            .attr("x", (d) => withinGroupX2(d.target))
            .attr("y", (d) => y2(d.dps))
            .attr("height", (d) => height - y2(d.dps))
            .attr("width", withinGroupX2.bandwidth())
            .attr("fill", (d) => targetZ(d.target));
    g2.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y2))
        .selectAll("text")
        .attr("font-size", 14);
    g2.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(groupX2))
        // rotated text from https://bl.ocks.org/mbostock/4403522
        .selectAll("text")
        .attr("transform", "rotate(45)")
        .attr("x", 9)
        .attr("dy", ".1em")
        .attr("font-size", 14)
        .style("text-anchor", "start")
    let legend2 = svg2.append("g").attr("transform", `translate(${width2+margin2.left}, ${height2/4})`);
    let legendYScale2 = d3.scaleBand().domain(targets).rangeRound([0, 250]);
    legend2.selectAll("g")
        .data(targets)
        .enter()
        .append("g")
        .append("rect")
        .attr("fill", (d) => targetZ(d))
        .attr("width", LEGEND_SQUARE_SIZE)
        .attr("height", LEGEND_SQUARE_SIZE)
        .attr("y", (d) => legendYScale2(d))
    legend2.selectAll("g")
        .append("text")
        .attr("y", (d) => legendYScale2(d)+LEGEND_SQUARE_SIZE*3/4)
        .attr("x", (d) => LEGEND_SQUARE_SIZE+3)
        .attr("font-size", 14)
        .text((d) => d);
    g2.append("text")   
        .attr("transform", `translate(${-margin.left/6}, ${height/2}) rotate(270)`)
        .text("DPS")
        .attr("font-size", 20)
});