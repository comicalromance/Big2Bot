const deckSize = 52;
let Suits = ["Diamond", "Club", "Heart", "Spade"];
let SuitValues = {
    "Diamond": 1,
    "Club": 2,
    "Heart": 3,
    "Spade": 4
}
let SuitCode = {
    "Diamond": "0x2666",
    "Club": "0x2663",
    "Heart": "0x2665",
    "Spade": "0x2660"
}

function convertToString(Card) {
    let cardString = Card.number;
    if(Card.number == 11) cardString = "J";
    else if(Card.number == 12) cardString = "Q";
    else if(Card.number == 13) cardString = "K";
    else if(Card.number == 14) cardString = "A";
    else if(Card.number == 15) cardString = 2;
    cardString += String.fromCodePoint(SuitCode[Card.suit]);
    return cardString;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateDeck() {
    let Deck = [];
    for(let i=3;i<16;i++) {
        for(let j=0;j<4;j++) {
            Deck.push({"number": i, "suit": Suits[j]});
        }
    }
    return shuffleArray(shuffleArray(Deck));
}

function generateHands(Deck, players) {
    let Hands = [], Hand = [], handSize = deckSize/players;
    for(let i=0; i<players; i++) {
        for(let j=0; j<handSize; j++) {
            Hand.push(Deck[i*handSize + j]);
        }
        Hands.push(Hand);
        Hand = [];
    }
    return Hands;
}

function compare(b, a) {
    if(a.number == b.number) {
        return SuitValues[a.suit] - SuitValues[b.suit]
    }
    else return a.number - b.number;  
}

function sortHand(Hand) {
    return Hand.sort(compare);
}

function generateHistogram(Hand) {
    Histogram = {};
    for(let i = 3; i<16; i++) Histogram[i] = []; 
    for(let i of Hand) Histogram[i.number].push(i);
    return Histogram;
}

function generateSuitHistogram(Hand) {
    Histogram = {};
    for(let i = 0; i<4; i++) Histogram[Suits[i]] = []; 
    for(let i of Hand) Histogram[i.suit].push(i);
    return Histogram;
}

function generatePairs(Hand) {
    let Pairs = [], Histogram = generateHistogram(Hand);
    for(let i = 3; i<16; i++) {
        if(Histogram[i].length == 2) {
            Pairs.push([Histogram[i][0], Histogram[i][1]]);
        }
        else if(Histogram[i].length == 3) {
            Pairs.push([Histogram[i][0], Histogram[i][1]]);
            Pairs.push([Histogram[i][0], Histogram[i][2]]);
            Pairs.push([Histogram[i][1], Histogram[i][2]]);
        }
        else if(Histogram[i].length == 4) {
            Pairs.push([Histogram[i][0], Histogram[i][1]]);
            Pairs.push([Histogram[i][0], Histogram[i][2]]);
            Pairs.push([Histogram[i][0], Histogram[i][3]]);
            Pairs.push([Histogram[i][1], Histogram[i][2]]);
            Pairs.push([Histogram[i][1], Histogram[i][3]]);
            Pairs.push([Histogram[i][2], Histogram[i][3]]);
        }
    }
    return Pairs;
}

function generateStraight(Hand) {
    let Stack = [], Straight = [], Histogram = generateHistogram(Hand);
    for(let i = 3; i<16; i++) {
        if(!Histogram[i].length) {
            Stack = [];
            continue;
        }
        Stack.push(Histogram[i]);
        if(Stack.length == 5) {
            temp = [], temp2 = [];
            for(let j = 0; j < 5; j++) {
                for(let k of Stack[j]) {
                    if(!temp.length) temp2.push([k]);
                    else {
                        for(let m = 0; m < temp.length; m++) {
                            temp3 = temp[m].slice(0);
                            temp3.push(k);
                            temp2.push(temp3.slice(0));
                        }
                    }
                }
                temp = temp2.slice(0);
                temp2 = [];
            }
            Straight = Straight.concat(temp);
            Stack.shift();
        }
    }
    return Straight;
}

function combinations(arr, k){
    var i,
    subI,
    ret = [],
    sub,
    next;
    for(i = 0; i < arr.length; i++){
        if(k === 1){
            ret.push( [ arr[i] ] );
        }else{
            sub = combinations(arr.slice(i+1, arr.length), k-1);
            for(subI = 0; subI < sub.length; subI++ ){
                next = sub[subI];
                next.unshift(arr[i]);
                ret.push( next );
            }
        }
    }
    return ret;
}

function generateFlush(Hand) {
    let Flush = [], SuitHistogram = generateSuitHistogram(Hand);
    for(let i = 0; i < 4; i++) {
        if(SuitHistogram[Suits[i]].length < 5) continue;
        while(SuitHistogram[Suits[i]].length > 8) SuitHistogram[Suits[i]].shift();
        Flush = Flush.concat(combinations(SuitHistogram[Suits[i]], 5)); 
    }
    return Flush;
}

function generateHouse(Hand) {
    let House = [], Histogram = generateHistogram(Hand);
    for(let i = 3; i<16; i++) {
        if(Histogram[i].length >= 3) {
            for(let j = 3; j<16; j++) {
                if(j == i) continue;
                if(Histogram[j].length >= 2) {
                    let temp = combinations(Histogram[i], 3), temp2 = combinations(Histogram[j], 2);
                    for(let m = 0; m < temp.length; m++) {
                        for(let n = 0; n < temp2.length; n++) {
                            let temp3 = temp[m].concat(temp2[n]);
                            House.push(temp3.slice(0));
                        }
                    }
                }
            }
        }
    }
    return House;
}

function generateFour(Hand) {
    let Four = [], Histogram = generateHistogram(Hand);
    for(let i = 3; i<16; i++) {
        if(Histogram[i].length == 4) {
            for(let j = 12; j >= 0; j--) {
                if(Hand[j].number != i) {
                    Four.push(Histogram[i].concat([Hand[j]]));
                }
            }
        }
    }
    return Four;
}

function generateSets(Hand) {
    return [generateStraight(Hand), generateFlush(Hand), generateHouse(Hand), generateFour(Hand)];
}


let deck = generateDeck();
let hands = generateHands(deck, 4);
sortHand(hands[0]);
let pairs = generatePairs(hands[0]);
let flush = generateFlush(hands[0]);



