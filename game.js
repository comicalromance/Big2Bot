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
let SetValues = {
    "Straight": 1,
    "Flush": 2,
    "House": 3,
    "Four": 4
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

function find3Dim(Hand) {
    for(let Card of Hand) {
        if(Card.number == 3 && Card.suit == "Diamond") return true;
    }
    return false;
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

function generateHands(players) {
    let Hands = [], Hand = [], handSize = deckSize/players, Deck = generateDeck();
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

function generatePairs(Hand, Limit = 3) {
    let Pairs = [], Histogram = generateHistogram(Hand);
    for(let i = Limit; i<16; i++) {
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

function generateSingles(Hand, Limit = 3, Suit) {
    let Singles = [], SuitVal;
    if(!Suit) SuitVal = 0;
    else SuitVal = SuitValues[Suit];
    for(let i=Hand.length-1; i >= 0; i--) {
        if(Hand[i].number > Limit ) Singles.push({type: "single", card: Hand[i]});
        else if(Hand[i].number == Limit && SuitValues[Hand[i].suit] > SuitVal) Singles.push({type: "single", card: Hand[i]});
    }
    return Singles;
}

function generateStraight(Hand, Limit) {
    let Stack = [], Straight = [], Histogram = generateHistogram(Hand);
    if(Limit >= 7) Limit -= 4;
    else Limit = 3;
    for(let i = Limit; i<16; i++) {
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
            for(let j of temp) {
                Straight.push({"type": "straight", "number": i, "set": j.slice(0)});
            }
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

function generateFlush(Hand, SuitLimit) {
    let Flush = [], SuitHistogram = generateSuitHistogram(Hand), Limit;
    if(SuitLimit) Limit = SuitValues[SuitLimit] - 1;
    else Limit = 0; 
    for(let i = Limit; i < 4; i++) {
        if(SuitHistogram[Suits[i]].length < 5) continue;
        while(SuitHistogram[Suits[i]].length > 8) SuitHistogram[Suits[i]].shift();
        let res = combinations(SuitHistogram[Suits[i]], 5);
        for (let j of res) Flush.push({"type": "flush", "suit": Suits[i], "set":j.slice(0)}); 
    }
    return Flush;
}

function generateHouse(Hand, Limit=3) {
    let House = [], Histogram = generateHistogram(Hand);
    for(let i = Limit; i<16; i++) {
        if(Histogram[i].length >= 3) {
            for(let j = 3; j<16; j++) {
                if(j == i) continue;
                if(Histogram[j].length >= 2) {
                    let temp = combinations(Histogram[i], 3), temp2 = combinations(Histogram[j], 2);
                    for(let m = 0; m < temp.length; m++) {
                        for(let n = 0; n < temp2.length; n++) {
                            let temp3 = temp[m].concat(temp2[n]);
                            House.push({"type": "house", "number": i, "set": temp3.slice(0)});
                        }
                    }
                }
            }
        }
    }
    return House;
}

function generateFour(Hand, Limit) {
    let Four = [], Histogram = generateHistogram(Hand);
    if(!Limit) Limit = 3;
    for(let i = 3; i<16; i++) {
        if(Histogram[i].length == 4) {
            for(let j = 12; j >= 0; j--) {
                if(Hand[j].number != i) {
                    Four.push({"type": "four", "number": i, "set": Histogram[i].concat([Hand[j]])});
                }
            }
        }
    }
    return Four;
}

function generateSets(Hand, Set) {
    let Sets = [], rank;
    if(Set) rank = SetValues[Set.type];
    else {
        rank = 0;
        Set = {}
    }
    if(rank <= 1) Sets.push(generateStraight(Hand, Set.number));
    else Sets.push([]);
    if(rank <= 2) Sets.push(generateFlush(Hand, Set.suit));
    else Sets.push([]);
    if(rank <= 3) Sets.push(generateHouse(Hand, Set.number));
    else Sets.push([]);
    if(rank <= 4) Sets.push(generateFour(Hand, Set.number));
    else Sets.push([]); 
    return Sets;
}

function convertToAction(Set) {
    let action = "";
    if(Set.type == "single") {
        action = `single ${Set.card.number} ${Set.card.suit}`;
    }
    return action;
}

function generateStartingKeyboard(Hand) {
    let optionsKeyboard = [{text: "Play Singles", action: "single"}];
    if(generatePairs(Hand).length) optionsKeyboard.push({text: "Play Pairs", action: "pair"});
    if(generateSets(Hand).length) optionsKeyboard.push({text: "Play Sets", action: "set"});
    return optionsKeyboard;
}

function generateSingleOptions(Hand) {
    let singles = generateSingles(Hand);
    let optionsKeyboard = [];
    for(let card in singles) {
        optionsKeyboard.push({text: convertToString(card), action: convertToAction(card)});
    }
    return optionsKeyboard;
}

function generateStartingOptions(Hand, action) {
    let options = [];
    if(action == "start") {
        options.push(generateStartingKeyboard(Hand));
    }
    else if(action == "single") {
        options.push(generateSingleOptions(Hand));
    }
    else if(Set.length == 2) {
        options.push(generatePairs(Hand, Set[0].number));
    }
    else if(Set.length > 2) {
        options.push(generateSets(Hand, Set));
    }
    return options;
}

function generateOptions(Hand, Set = []) {
    let options = [];
    if(Set.length == 1) {
        options.push(generateSingles(Hand, Set[0].number, Set[0].suit));
    }
    else if(Set.length == 2) {
        options.push(generatePairs(Hand, Set[0].number));
    }
    else if(Set.length > 2) {
        options.push(generateSets(Hand, Set));
    }
    return options;
}


let hands = generateHands(4);
sortHand(hands[0]);
let pairs = generatePairs(hands[0]);
let flush = generateFlush(hands[0]);

module.exports = {find3Dim, convertToString, generateHands, sortHand, generatePairs, generateSingles, generateSets, generateOptions, generateStartingOptions}

