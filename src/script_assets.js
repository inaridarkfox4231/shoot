

function setup(){
	createCanvas(400, 500);
  noLoop();
	noStroke();
	rectMode(CENTER);
	//let gr = createGraphics(400, 400);
	//console.log(gr.width);
}

function draw(){
	background(220);
	drawBall(50, 50, 20, color("#ff0000")); // 赤
	drawBall(100, 50, 20, color("#ffa500")); // 橙
	drawBall(150, 50, 20, color("#ffff00")); // 黄
	drawBall(200, 50, 20, color("#008000")); // 緑
	drawBall(50, 100, 20, color("#00bfff")); // 水色
	drawBall(100, 100, 20, color("#0000cd")); // 青
	drawBall(150, 100, 20, color("#800080")); // 紫
	drawBall(200, 100, 20, color("#ff1493")); // 桃
	drawBall(50, 150, 20, color("#ff0000"), 0.7); // 赤
	drawBall(100, 150, 20, color("#ffa500"), 0.7); // 橙
	drawBall(150, 150, 20, color("#ffff00"), 0.7); // 黄
	drawBall(200, 150, 20, color("#008000"), 0.7); // 緑
	drawBall(50, 200, 20, color("#00bfff"), 0.7); // 水色
	drawBall(100, 200, 20, color("#0000cd"), 0.7); // 青
	drawBall(150, 200, 20, color("#800080"), 0.7); // 紫
	drawBall(200, 200, 20, color("#ff1493"), 0.7); // 桃
	drawIceBall(250, 250, 20);
	drawIceBall(300, 250, 20, 0.5);
	drawThunderBall(250, 300, 20);
	drawThunderBall(300, 300, 20, 0.5);
	drawHeavyBall(250, 350, 20);
	drawHeavyBall(300, 350, 20, 0.5);
	drawMagicBall(250, 400, 20);
	drawMagicBall(300, 400, 20, 0.5);
	drawButton(300, 50, 60, 40, color("#ff0000"), 0.0);
	drawButton(300, 100, 60, 40, color("#ff0000"), 0.35);
	drawButton(300, 150, 60, 40, color("#ff0000"), 0.7);
}

function drawBall(x, y, radius, ballColor, paleRatio = 0.0){
	// paleRatioが1に近いほど薄くなる。発光しているときは0.7くらいにしよう。
	for(let i = 0; i < 100; i++){
		const prg = 0.5 * (1 - cos(PI * (i / 100)));
		//const prg = i / 100;
		//const prg = pow(i / 100, 3);
		const lerped = lerpColor(ballColor, color(255), paleRatio + prg * (1 - paleRatio))
		fill(lerped);
		circle(x, y, radius * 2 * (1 - i / 100));
	}
}

function drawIceBall(x, y, radius, paleRatio = 0.0){
	// まずradiusの20%まで外側から水色→白のグラデーションで30分割くらいで円弧を描く（noFill）
	// ベースは薄い水色で。
	// 最後に濃い水色のダイヤを30°ずつ回転させて6つ描く感じ。中心に半径の20%の円を描いてその上を点が動く感じ。
	const baseColor = lerpColor(color(0, 162, 232), color(255), paleRatio);
	fill(lerpColor(baseColor, color(255), 0.4));
	circle(x, y, radius * 2);
	noFill();
	for(let i = 0; i < 30; i++){
		let prg = i / 30;
		prg = pow(prg, 2);
		stroke(lerpColor(baseColor, color(255), prg));
		strokeWeight(radius * 0.4 / 30);
		arc(x, y, radius * (2 - 0.8 * prg), radius * (2 - 0.8 * prg), 0, 2 * PI);
	}
	noStroke();
	let p = [];
	for(let k = 0; k < 12; k++){
		p.push({x:radius * 0.9 * cos(PI * k / 6), y:radius * 0.9 * sin(PI * k / 6)});
	}
	for(let k = 0; k < 12; k++){
		// PI/2足すことで記述を簡潔にする。
		p.push({x:radius * 0.1 * cos(PI * k / 6 + PI / 2), y:radius * 0.1 * sin(PI * k / 6 + PI / 2)});
	}
	for(let pt of p){ pt.x += x; pt.y += y; }
	fill(baseColor);
	for(let k = 0; k < 6; k++){
		quad(p[k].x, p[k].y, p[k + 12].x, p[k + 12].y, p[k + 6].x, p[k + 6].y, p[k + 18].x, p[k + 18].y);
	}
}

function drawThunderBall(x, y, radius, paleRatio = 0.0){
	// オレンジ、中央に稲妻。
	const baseColor = lerpColor(color(255, 144, 0), color(255), paleRatio);
	fill(lerpColor(baseColor, color(255), 0.4));
	circle(x, y, radius * 2);
	noFill();
	for(let i = 0; i < 30; i++){
		let prg = i / 30;
		prg = pow(prg, 2);
		stroke(lerpColor(baseColor, color(255), prg));
		strokeWeight(radius * 0.4 / 30);
		arc(x, y, radius * (2 - 0.8 * prg), radius * (2 - 0.8 * prg), 0, 2 * PI);
	}
	noStroke();
	// 稲妻を二つの三角形で表現。
	fill(baseColor);
	triangle(x - radius * 0.1, y, x - radius * 0.2, y + radius * 0.8, x + radius * 0.4, y);
	triangle(x + radius * 0.1, y, x + radius * 0.2, y - radius * 0.8, x - radius * 0.4, y);
}

function drawHeavyBall(x, y, radius, paleRatio = 0.0){
	// 基本色は灰色系、中央に逆さ向きのmoon.
	const baseColor = lerpColor(color(64), color(255), paleRatio);
	fill(lerpColor(baseColor, color(255), 0.4));
	circle(x, y, radius * 2);
	noFill();
	for(let i = 0; i < 30; i++){
		let prg = i / 30;
		prg = pow(prg, 2);
		stroke(lerpColor(baseColor, color(255), prg));
		strokeWeight(radius * 0.4 / 30);
		arc(x, y, radius * (2 - 0.8 * prg), radius * (2 - 0.8 * prg), 0, 2 * PI);
	}
	noStroke();
	// まず円を描いてちょっと上に同じ大きさの円をlerpedBaseColorで描く
	fill(baseColor);
	circle(x, y, radius * 0.8);
	fill(lerpColor(baseColor, color(255), 0.4));
	circle(x, y - radius * 0.2, radius * 0.6);
}

function drawMagicBall(x, y, radius, paleRatio = 0.0){
	// 紫系。六芒星。
	// ぶつかるとそのボールに変化する。ただしヘビーに当たると変化できずにpaleが発動する。
	const baseColor = lerpColor(color(138, 62, 138), color(255), paleRatio);
	fill(lerpColor(baseColor, color(255), 0.4));
	circle(x, y, radius * 2);
	noFill();
	for(let i = 0; i < 30; i++){
		let prg = i / 30;
		prg = pow(prg, 2);
		stroke(lerpColor(baseColor, color(255), prg));
		strokeWeight(radius * 0.4 / 30);
		arc(x, y, radius * (2 - 0.8 * prg), radius * (2 - 0.8 * prg), 0, 2 * PI);
	}
	noStroke();
	let p = [];
	for(let i = 0; i < 6; i++){
		p.push({x:x + radius * 0.5 * cos(PI * i / 3 + PI / 6), y:y + radius * 0.5 * sin(PI * i / 3 + PI / 6)});
	}
	fill(baseColor);
	triangle(p[0].x, p[0].y, p[2].x, p[2].y, p[4].x, p[4].y);
	triangle(p[1].x, p[1].y, p[3].x, p[3].y, p[5].x, p[5].y);
}


function drawButton(x, y, w, h, buttonColor, paleRatio = 0.0){
	// paleRatioが1に近いほど薄くなる。未選択のボタンの画像はこれでいこう（0.8くらいにする）
	const edgeLength = min(w, h) * 0.1;
	const properColor = lerpColor(buttonColor, color(255), paleRatio);
	fill(lerpColor(properColor, color(255), 0.3));
	rect(x, y, w, h);
	fill(lerpColor(properColor, color(0), 0.3));
	rect(x + edgeLength * 0.5, y + edgeLength * 0.5, w - edgeLength, h - edgeLength);
	fill(properColor);
	rect(x, y, w - edgeLength * 2, h - edgeLength * 2);
}
