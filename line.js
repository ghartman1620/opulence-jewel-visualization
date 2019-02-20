let svg3 = d3.select("#support-jewel-chart");
let margin3 = {left: 300, top: 100, right: 500, bottom: 40};
let width3 = +svg.attr("width") - margin3.left - margin3.right;
let height3 = +svg.attr("height") - margin3.top - margin3.bottom;

// Let's make a line chart! It will show, for a particular group size,
// The average dps of groups who took particular numbers of jewels.
let x3 = d3.scaleLinear().range([0, width3]);
let y3 = d3.scaleLinear().range([height3, 0]);
let z3 = d3.scaleOrdinal().range(["#e66101", "#fdb863"]);
let g3 = svg3.append("g").attr("transform", `translate(${margin3.left}, ${margin3.bottom})`)
/*
Interpreting data that looks like:
Interpreting one set of players at a time (slider to select size.)
One line each for ruby and topaz
X on the line is the key (count of how many of that jewel)
Y on the line is avg dps per group (dps/count)

We can add the jewel count as a property to the object. See the 0 ruby example below
{
  looking at parses with 10 players:
  10: {
    dps by ruby count:
    ruby: {
      groups that had 10 ruby
      0: {
        how many rubies we're thinking about (same as key)
        jewel-count: 0
        how many groups had 0 ruby
        count: 
        how much dps per player did they deal
        dps:
      }
      etc for other count of rubies
      1: {...}
    }
    etc for other count of topaz
    topaz: {...}
  }
  11: {...}
}
*/

let line = d3.line()
    .x((d) => {
        return x3(d["jewel-count"]);
    })
    .y((d) => {
        return y3(d["avg_dps_sum"]/d["count"]);
    })



const support_jewels = [
    "Ruby of Focused Animus",
    "Topaz of Brilliant Sunlight"
]

// previously - "groupsizedps_perdps_progress2.json"
d3.json("groupsizedps_progress_final.json", (data) => {
    // create a function to draw the line chart for a particular
    // group size, using that group size's data.
    let totalCount = 0;
    
    // also want an aggregate.
    let aggregate = {}
    for(let jewel of support_jewels){
        aggregate[jewel] = {}
    }
    for(let size of Object.keys(data)){
        for(let jewel of support_jewels){
            for(let jewelCount of Object.keys(data[size][jewel])){
                if(aggregate[jewel][jewelCount] === undefined){
                    aggregate[jewel][jewelCount] = {
                        "count": 0,
                        "avg_dps_sum" : 0,
                    }
                }
                aggregate[jewel][jewelCount]["count"] += data[size][jewel][jewelCount]["count"];
                aggregate[jewel][jewelCount]["avg_dps_sum"] += data[size][jewel][jewelCount]["avg_dps_sum"];
            }
        }
    }
    data["total"] = aggregate
    
    
    for(let size of Object.keys(data)){
        for(let jewel of Object.keys(data[size])){
            for(let jewelCount of Object.keys(data[size][jewel])){
                if (data[size][jewel][jewelCount]["count"] < 20){
                    delete data[size][jewel][jewelCount]
                }
                else {
                    data[size][jewel][jewelCount]["jewel-count"] = +jewelCount;
                    totalCount += data[size][jewel][jewelCount]["count"];
                    data[size][jewel][jewelCount]["avg"] = 
                        data[size][jewel][jewelCount]["avg_dps_sum"]/
                        data[size][jewel][jewelCount]["count"];
                }
            }
            if(Object.keys(data[size][jewel]).length === 0){
                delete data[size][jewel];
            }
        }
    }
    let maxCount = 0;
    let maxCountSize = 0;
    for(let size of Object.keys(data)){
        let count = 0;
        for(let jewel of Object.keys(data[size])){
            for(let jewelCount of Object.keys(data[size][jewel])){
                count += data[size][jewel][jewelCount]["count"];
            }
        }
        if(count > maxCount){
            maxCount = count;
            maxCountSize = size;
        }
    }
    
    x3.domain([
        0,
        d3.max(Object.keys(data), (size) => {
            return d3.max(support_jewels, (jewel) => {
                
                if (data[size][jewel] === undefined) return 0;
                return d3.max(Object.keys(data[size][jewel]), (key) => {
                    return data[size][jewel][key]["jewel-count"]
                });
            })
        }),
    ]);
    y3.domain([
        d3.min(Object.keys(data), (size) => {
            return d3.min(support_jewels, (jewel) => {
                if (data[size][jewel] === undefined) return Number.MAX_SAFE_INTEGER;
                let min = d3.min(Object.keys(data[size][jewel]), (key) => {
                    return data[size][jewel][key]["avg"]
                });
                return min;
            })
        }),
        d3.max(Object.keys(data), (size) => {
            return d3.max(support_jewels, (jewel) => {
                if (data[size][jewel] === undefined) return 0;
                return d3.max(Object.keys(data[size][jewel]), (key) => {
                    return data[size][jewel][key]["avg"]
                });
            })
        })
    ]);
    var drawLinesForSize = (size) => {
        g3.html("");
        
        
        z3.domain(support_jewels);
        
        // ruby line
        for(let jewel of support_jewels){
            g3.append("path")
                .datum(Object.keys(data[size][jewel]).map((key) => data[size][jewel][key]))
                .attr("fill", "none")
                .attr("stroke-width", 2)
                .attr("stroke", z3(jewel))
                .attr("d", line) 
        }
        
            
        
        g3.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0, ${height3})`)
            .call(d3.axisBottom(x3));
        g3.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y3));
        g3.append("text")
            .attr("transform", `translate(${-50}, ${height3/2}) rotate(270)`)
            .attr("text-anchor", "center")
            .text("Average DPS")
        g3.append("text")
            .attr("transform", `translate(${width/2}, ${height3+margin3.bottom})`)
            .attr("text-anchor", "center")
            .text("Jewel Count")
        
        const LEGEND_SQUARE_SIZE = 25;
        let legendY = d3.scaleBand().domain(support_jewels).range([0, 250]);
        let legend = svg3.selectAll(".legend-group")
            .data(support_jewels)
            .enter()
            .append("g")
            .attr("class", "legend-group");
        legend.append("rect")
            .attr("x", width3 + margin3.left)
            .attr("y", (d) => height/2 + legendY(d))
            .attr("width", LEGEND_SQUARE_SIZE)
            .attr("height", LEGEND_SQUARE_SIZE)
            .attr("fill", (d) => z3(d))
        legend.append("text")
            .text((d) => d)
            .attr("transform", (d) => `translate(${width3 + margin3.left + LEGEND_SQUARE_SIZE}, ${height/2 + legendY(d) + 3*LEGEND_SQUARE_SIZE/4})`)   
        
    }
    drawLinesForSize("total");
    // from https://bl.ocks.org/johnwalley/e1d256b81e51da68f7feb632a53c3518
    let sliderstep = d3
        .sliderBottom()
        .min(10)
        .max(30)
        .width(300)
        .ticks(5)
        .step(1)
        .default(20)
        .on('onchange', val => {
            drawLinesForSize(val);
            d3.select("#lineCheckbox").property("checked", false);
        });
    let sliderGroup = svg3.append("g")
        .attr("transform", `translate(${width/2}, ${margin.top/2})`);
    sliderGroup.call(sliderstep);
    
    d3.select("#lineCheckbox").on("change", () => {
        if(d3.select("#lineCheckbox").property("checked")){
            drawLinesForSize("total");
        }
        else {
            drawLinesForSize(sliderstep.value());
        }
    });
    
});
