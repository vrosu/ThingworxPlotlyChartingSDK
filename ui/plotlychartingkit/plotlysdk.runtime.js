/*
    This file is essentially a partial class for a charting widget in the runtime
    it has functions to help render and draw a chart and extends the widget by adding 
    additional function callbacks so they do not need to be called by the instance of 
    the chart widget and thus repeated for every chart.
*/ 
function TWRuntimeChart(widget) {
    let properties = widget.properties;
    let chartId;
    let chart = this;
    
    //expose the layout and chart data so you can access them from within the source widget
    //This gives the user more control over the chart and allows overriding the sdk
    this.layout = new Object;
    this.chartData = [];
    this.chartInfo = {};
    this.chartDiv;

    //this just lets the chart widget know if its already drawn the chart at least once
    //this is useful for streaming charts that might want to draw once and then extend after the first draw
    this.plotted = false;

    //This should be called in afterRender and it renders the chart onto the div with the appropriate layout settings
    this.render = function() {
        chartId = widget.jqElementId;

        chart.chartData = [];
        //need the actual div to add events
        let chartDiv = document.getElementById(widget.jqElementId);

        chart.layout = {
			showlegend: properties['ShowLegend'],
			legend: {'orientation': 'h'},
			font: {
				color: 'black',
				size: 11
            },
            plot_bgcolor: '#fff'
        };

        //set up the layout
        if (properties['ShowTitle']) {
            let titleStyle = TW.getStyleFromStyleDefinition(properties['ChartTitleStyle'],'DefaultChartTitleStyle');
            let title = new Object();
            title.text = properties['ChartTitle'];
            title.font = new Object();
            title.font.size = Number(getFontSize(titleStyle.textSize));
            title.font.color = titleStyle.foregroundColor;
            title.x = properties['ChartTitleX'];
            title.y = properties['ChartTitleY'];
            chart.layout.title = title;
        }

        let margin = new Object();
        margin.t = properties['MarginTop'];
        margin.b = properties['MarginBottom'];
        margin.l = properties['MarginLeft'];
        margin.r = properties['MarginRight'];

        chart.layout.margin = margin;

        //Set up the axes. Axis 1 is a bit different from the others, because there is no trailing number for them
        chart.layout.xaxis = getAxisObject('X',1);
        chart.layout.yaxis = getAxisObject('Y',1);

        for (let i = 2; i <= properties['NumberOfXAxes'];i++) {
            chart.layout['xaxis' + i] = getAxisObject('X',i);
        }
        for (let i = 2; i <= properties['NumberOfYAxes'];i++) {
            chart.layout['yaxis' + i] = getAxisObject('Y',i);
        }
        
        //draw the chart
        Plotly.newPlot(chartDiv, chart.chartData, chart.layout, {displayModeBar: false});

        //Add our click event
        if (properties['AllowSelection']) {
            chartDiv.on('plotly_click', chart.handleClick);
        }

    }

    //extend takes in just new data and adds it to the trace. Need to pass in trace number here, right now this only works for index 0.
    this.extend = function(data) {
        Plotly.extendTraces(chartId,data, [0]);

    }


    //this is where we actually get in data and draw it onto the chart
    this.draw = function(data) {
        chart.plotted = true;
        for (let i=1;i<=data.length;i++) {
            trace = data[i-1];
            let series = trace.series;
            if (trace.type == "scatter") {
                let style = TW.getStyleFromStyleDefinition(properties['SeriesStyle' + series],'DefaultChartStyle' + series);
                let line = new Object();
                line.color = style.lineColor;
                trace.line = line;
                trace.name = properties['SeriesLabel' + series];
                if (properties['XAxis' + series] !== 'x1') {
                    trace.xaxis = properties['XAxis' + series];
                };
                if (properties['YAxis' + series] !== 'y1') {
                    trace.yaxis = properties['YAxis' + series];
                };
            }

            let exists = false;
            for (let i = 0; i<chart.chartData.length;i++) {
                if (trace.series === chart.chartData[i].series) {
                    chart.chartData[i] = trace;
                    exists = chart;
                }
            }
            if (!exists) {
                chart.chartData.push(trace);
            }
            
        }

        Plotly.react(chartId,chart.chartData,chart.layout,{displayModeBar: false});
    }

    //This will highlight a bar or marker and make sure that the others go back to their original color. 
    //Somewhat annoying that you need the whole color array for each point to do this
    //We just get the length of the series from chart info (this has to be set by the chart widget) and grab the series style for our array
    //and then we can store it in our chart info for later use. Then we update the selected marker
    this.handleClick = function(data)
    {
        let pn='',
        tn='',
        series = '',
        source = '';
        for(let i=0; i < data.points.length; i++){
            pn = data.points[i].pointNumber;
            tn = data.points[i].curveNumber;
            series = data.points[i].data.series;
            source = data.points[i].data.dataSource;
        };
        let colors = [];
        if (!chart.chartInfo[source]['SeriesStyle' + series]) {
            colors = Array(chart.chartInfo[source].length);
            let style = TW.getStyleFromStyleDefinition(properties['SeriesStyle' + series],'DefaultChartStyle' + series);
            for (let i = 0; i<chart.chartInfo[source].length;i++) {
                colors[i] = style.lineColor;
            }
            chart.chartInfo[source]['SeriesStyle' + series] = colors.splice(0);
        }
        colors = chart.chartInfo[source]['SeriesStyle' + series].slice(0);
        colors[pn] = '#FF0000';

        var update = {'marker':{color: colors}};
        Plotly.restyle(chartId, update, [tn]);
    };

    this.handleSelectionUpdate = function (propertyName, selectedRows, selectedRowIndices) {
    
    };

    function getFontSize(text) {
    	return TW.getTextSize(text).split(": ")[1].replace("px;","");
    };

    this.getXY = function(it) {
		const rows = it.ActualDataRows;
		let values = new Object();
        let x = [];       
        let y = new Object();
        
        for (let i=0;i<rows.length;i++) {
        	x.push(rows[i][properties['XAxisField']]);
       	for (let j=1;j<=properties['NumberOfSeries'];j++) {
       		if (properties['YDataField' + j]) {
					if (!y[j]) {	
						y[j] = new Object();
						y[j].values = [];
					};
		    		y[j].values.push(rows[i][properties['YDataField' + j]]);
       		};
       	};
        };
        
        values.x = x;
        values.y = y;
        
        return values;
	}
	this.getDynamicXY = function(it) {
		const rows = it.ActualDataRows;
		let values = new Object();
        let x = [];
        let y = {};
		let shape = it.DataShape;
		
		for (let i=0;i<rows.length;i++) {
			let count = 1;
			x.push(rows[i][properties['XAxisField']]);
			for (let key in shape) {
				if (shape[key].baseType === 'NUMBER' || shape[key].baseType === 'INTEGER') {
					if (!y[count]) {	
						y[count] = new Object();
						y[count].values = [];
					};
					y[count].values.push(rows[i][key]);
					count++;
				};
			};
		};
		values.x = x;
		values.y = y;
		
        return values
    };
    
    function getAxisObject(xy,i) {
        
        let style = TW.getStyleFromStyleDefinition(properties[xy + 'AxisStyle' + i],'DefaultChartStyle' + i);
        let tickStyle = TW.getStyleFromStyleDefinition(properties[xy + 'AxisTickStyle' + i],'DefaultChartStyle' + i);
        let lineStyle = TW.getStyleFromStyleDefinition(properties[xy + 'AxesLineStyle'],'DefaultChartStyle');
        let gridStyle = TW.getStyleFromStyleDefinition(properties[xy + 'AxesGridStyle'],'DefaultChartStyle');

        let axis = new Object();
        axis.visible = properties[xy + 'AxesVisible'];
        axis.title = {
            text: properties[xy + 'AxisTitle' + i],
            font: {
                color: style.foregroundColor,
                size: getFontSize(style.textSize)
            }
        },
        axis.type = properties[xy + 'AxisType' + i];
        axis.autorange = properties[xy + 'AxesAuto'];
        axis.tickmode = properties[xy + 'AxesTicks'];
        axis.nticks = properties[xy + 'AxesTickMax'];
        axis.tickwidth = properties[xy + 'AxesTickWidth'];
        axis.tickcolor = tickStyle.backgroundColor;
        axis.tickfont = {
            color: tickStyle.backgroundColor,
            size: getFontSize(tickStyle.textSize)
        };
        axis.tickangle = properties[xy + 'AxesTickAngle'];
        axis.tickformat = properties[xy + 'AxisTickFormat' + i];
        axis.showline = properties[xy + 'AxesShowLine'];
        axis.linecolor = lineStyle.backgroundColor;
        axis.showgrid = properties[xy + 'AxesShowGrid'];
        axis.gridstyle = gridStyle.backgroundColor;
        if (i>1) {
            axis.overlaying = xy.toLowerCase();
            axis.side = properties[xy + 'AxisSide' + i];
            axis.position = properties[xy + 'AxisPosition' + i];
            axis.anchor = properties[xy + 'AxisAnchor' + i]
        }
        return axis;
    }

    widget.resize = function(width,height) {
        let update = {
            width: width,
            height: height
        }

        Plotly.relayout(chartId, update);
    };

    widget.runtimeProperties = function () {
        return {
            'needsDataLoadingAndError': true,
	        'supportsAutoResize': true
        };
    };

    widget.beforeDestroy = function () {
       Plotly.purge(chartId);
    };


}