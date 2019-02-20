let svg4 = d3.select("#combination-plot");
let margin4 = {left: 300, top: 100, right: 500, bottom: 40};
let width4 = +svg.attr("width") - margin4.left - margin4.right;
let height4 = +svg.attr("height") - margin4.top - margin4.bottom;

// Let's make a line chart! It will show, for a particular group size,
// The average dps of groups who took particular numbers of jewels.
let x4 = d3.scaleLinear().range([0, width3]);
let y4 = d3.scaleLinear().range([height3, 0]);
let z4 = d3.scaleQuantize().range(["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"]);
let g4 = svg4.append("g").attr("transform", `translate(${margin4.left}, ${margin4.bottom})`)


const RUBY_STR = "Ruby of Focused Animus";
const TOPAZ_STR = "Topaz of Brilliant Sunlight";
// previously - "jewelcombinationdps_progress2.json"
d3.json("jewelcombinationdps_progress_final.json", (data) => {
    let aggregate = [];
    for(let size of Object.keys(data)){
        for(let obj of data[size]){
            let found = false;
            for(let item of aggregate){
                if (item[TOPAZ_STR] === obj[TOPAZ_STR] &&
                    item[RUBY_STR] == obj[RUBY_STR]){
                    item["count"] += obj["count"];
                    item["avg_dps_sum"] += obj ["avg_dps_sum"]
                    found = true;
                }
            }
            if(!found){
                aggregate.push({
                    "count" : obj["count"],
                    "avg_dps_sum" : obj["avg_dps_sum"],
                    [RUBY_STR]: obj[RUBY_STR],
                    [TOPAZ_STR]: obj[TOPAZ_STR]
                })
            }
            obj["avg"] = obj["avg_dps_sum"]/obj["count"];
        }
    }
    const MIN_COUNT = 10;
    let maxRuby = d3.max(aggregate.filter((obj) => obj["count"] >= MIN_COUNT), (obj) => obj[RUBY_STR]) + 1;
    let maxTopaz = d3.max(aggregate.filter((obj) => obj["count"] >= MIN_COUNT), (obj) => obj[TOPAZ_STR])+ 1;
    
    data["total"] = aggregate;
    for(let obj of aggregate){
        obj["avg"] = obj["avg_dps_sum"]/obj["count"];
    }
    console.log(data);
    x4.domain([0, maxRuby]);
    y4.domain([0, maxTopaz]);
    
    console.log(z4.domain());
    console.log(z4.range());
    console.log(aggregate[0]["avg"]);
    console.log(z4(aggregate[0]["avg"]));
    console.log(z4(36000));
    let drawPlotForSize = (size) => {
        g4.html("");
        let selectedData = data[size].filter((obj) => obj["count"] > MIN_COUNT);
        z4.domain([
            d3.min(selectedData, (obj) => {
                return obj["avg"];
            }),
            d3.max(selectedData, (obj) => {
                return obj["avg"];
            })
        ]);
        let rectWidth = width/(x4.domain()[1]-x4.domain()[0]) - .5;
        let rectHeight = height/(y4.domain()[1]-y4.domain()[0]) - .5;
        g4.selectAll("rect")
            .data(selectedData)
            .enter()
            .append("rect")
            .attr("x", (d) => x4(d[RUBY_STR]))
            .attr("y", (d) => y4(d[TOPAZ_STR])-rectHeight)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("fill", (d) => z4(d["avg"]))
        
        
        g4.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0, ${height4})`)
            // from https://stackoverflow.com/questions/12643591/how-to-limit-d3-svg-axis-to-integer-labels
            .call(d3.axisBottom(x4).tickFormat((e) => {
                if(Math.floor(e) == e) return;
                return Math.floor(e);
            }));
        
        g4.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y4).tickFormat((e) => {
                if(Math.floor(e) == e) return;
                return Math.floor(e);
            }));
        g4.append("text")
        
            .attr("transform", `translate(${width4/2}, ${height4+margin4.top/2})`)
            .text("Number of Rubies")
        g4.append("text")
        
            .attr("transform", `translate(${-margin4.left/8}, ${height4/2}) rotate(270)`)
            .text("Number of Topaz")
        // from https://bl.ocks.org/clhenrick/8aa4c6a9b81ba7032281272255c3fb4d
        let legendOrdinal = d3.legendColor().scale(z4);
        svg4.append("g")
            .attr("class", "legendOrdinal")
            .attr("transform", `translate(${width4+margin4.left+10}, ${height/2})`)
        svg4.select(".legendOrdinal")
            .call(legendOrdinal);
            
    };
    drawPlotForSize("total");
    let sliderstep4 = d3
        .sliderBottom()
        .min(10)
        .max(30)
        .width(300)
        .ticks(5)
        .step(1)
        .default(20)
        .on('onchange', val => {
            drawPlotForSize(val);
            d3.select("#plotCheckbox").property("checked", false);
        });
    let sliderGroup = svg4.append("g")
        .attr("transform", `translate(${width/2}, ${margin.top/2})`);
    sliderGroup.call(sliderstep4);
    
    d3.select("#plotCheckbox").on("change", () => {
        if(d3.select("#plotCheckbox").property("checked")){
            drawPlotForSize("total");
        }
        else {
            drawPlotForSize(sliderstep.value());
        }
    });
});