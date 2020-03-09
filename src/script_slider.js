let myCursor1;
let mySlider1;

let myCursor2;
let mySlider2;

// あとはSliderSetでまとめてactivateやinActivateできるようにすればいいかな。
// グラフィックはデフォルトでおしゃれなの用意しておきましょうね。以上～

function setup(){
  createCanvas(400, 400);
  noStroke();
  myCursor1 = new Cursor("rect", {w:15, h:25}, 1.1);
  mySlider1 = new LineSlider(0, 100, myCursor1, createVector(50, 50), createVector(200, 50));
  mySlider1.initialize();
  myCursor2 = new Cursor("circle", {r:15}, 1.1);
  mySlider2 = new LineSlider(0, 100, myCursor2, createVector(100, 100), createVector(300, 300));
  mySlider2.initialize();
}

function draw(){
  background(220);
  mySlider1.update();
  mySlider2.update();
  mySlider1.draw();
  mySlider2.draw();
  fill(0);
  textSize(24);
  text(floor(mySlider1.getValue()), 100, 200);
  text(floor(mySlider2.getValue()), 100, 300);
}

// {type:"rect", x:20, y:40, w:40, h:20} // xとyは中心。wとhは幅。

class Slider{
  constructor(minValue, maxValue, cursor){
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.cursor = cursor;
    this.active = false;
  }
  initialize(){ /* カーソルの初期位置を決める */ }
  activate(){
    // マウス位置がカーソルにヒットしなければactiveにしない。
    if(!this.cursor.hit(mouseX, mouseY)){ return; }
    this.active = true;
  }
  inActivate(){
    this.active = false;
  }
  getValue(){ /* カーソルの位置と自身のレールデータから値を取り出す処理。形状による。 */ }
  update(){ /* activeであればmouseIsPressedである限りカーソルの位置を更新し続ける */ }
  draw(){ /* レールの形状がスライダーによるのでここには何も書けない */ }
}

// startとendは位置ベクトルで、それぞれがminとmaxに対応する。
class LineSlider extends Slider{
  constructor(minValue, maxValue, cursor, start, end){
    super(minValue, maxValue, cursor);
    this.start = start;
    this.end = end;
    this.length = p5.Vector.dist(start, end);
  }
  initialize(){
    // start位置におく。
    this.cursor.setPosition(this.start.x, this.start.y);
  }
  getValue(){
    // cursorのpositionのstartとendに対する相対位置の割合(prg)からvalueを割り出す。
    const prg = p5.Vector.dist(this.start, this.cursor.position) / this.length;
    return this.minValue * (1 - prg) + this.maxValue * prg;
  }
  update(){
    if(!this.active){ return; }
    // マウス位置から垂線を下ろしてratioを割り出す。ratioはconstrainで0以上1以下に落とす。
    const mousePosition = createVector(mouseX, mouseY);
    let ratio = p5.Vector.dot(p5.Vector.sub(this.start, this.end), p5.Vector.sub(this.start, mousePosition)) / pow(this.length, 2);
    ratio = constrain(ratio, 0, 1);
    const newPos = p5.Vector.add(p5.Vector.mult(this.start, 1 - ratio), p5.Vector.mult(this.end, ratio));
    this.cursor.setPosition(newPos.x, newPos.y);
  }
  draw(){
    stroke(0);
    strokeWeight(3.0);
    line(this.start.x, this.start.y, this.end.x, this.end.y);
    noStroke();
    this.cursor.draw();
  }
}

class Cursor{
  constructor(type, param, marginFactor = 1.0){
    this.type = type;
    this.position = createVector();
    this.param = param;
    this.marginFactor = marginFactor; // マウスダウン位置がカーソルの当たり判定からはみ出していても大丈夫なように。
    // たとえば1.1なら|x-mouseX|<(w/2)*1.1までOKとかそういうの。円形なら・・分かるよね。
    // offSetXとoffSetYは中心からgraphicの描画位置までの距離。
    switch(type){
      case "rect":
        this.offSetX = param.w * 0.5;
        this.offSetY = param.h * 0.5;
        break;
      case "circle":
        this.offSetX = param.r;
        this.offSetY = param.r;
        break;
    }
    this.graphic = this.createCursorGraphic();
  }
  createCursorGraphic(){
    let gr = createGraphics(this.offSetX * 2.0, this.offSetY * 2.0);
    // とりあえず単純に（あとできちんとやる）
    gr.noStroke();
    switch(this.type){
      case "rect":
        gr.fill(255, 0, 0);
        gr.rect(0, 0, this.param.w, this.param.h);
        break;
      case "circle":
        gr.fill(0, 0, 255);
        gr.circle(this.param.r, this.param.r, this.param.r * 2.0);
        break;
    }
    return gr;
  }
  setPosition(x, y){
    this.position.set(x, y);
  }
  hit(x, y){
    const {x:px, y:py} = this.position;
    switch(this.type){
      case "rect":
        return abs(x - px) < this.param.w * 0.5 * this.marginFactor && abs(y - py) < this.param.h * 0.5 * this.marginFactor;
      case "circle":
        return pow(x - px, 2) + pow(y - py, 2) < pow(this.param.r * this.marginFactor, 2);
    }
  }
  draw(){
    image(this.graphic, this.position.x - this.offSetX, this.position.y - this.offSetY);
  }
}

function mousePressed(){
  mySlider1.activate();
  mySlider2.activate();
}

function mouseReleased(){
  mySlider1.inActivate();
  mySlider2.inActivate();
}
