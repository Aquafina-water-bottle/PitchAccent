// copied/pasted directly from yomichan
// https://github.com/FooSoft/yomichan/blob/master/ext/js/language/sandbox/japanese-util.js
// I have no idea what is going on tbh but it seems to work
function isCodePointInRange(codePoint, [min, max]) {
  return (codePoint >= min && codePoint <= max);
}

function convertHiraganaToKatakana(text) {
  const HIRAGANA_CONVERSION_RANGE = [0x3041, 0x3096];
  const KATAKANA_CONVERSION_RANGE = [0x30a1, 0x30f6];

  let result = '';
  const offset = (KATAKANA_CONVERSION_RANGE[0] - HIRAGANA_CONVERSION_RANGE[0]);
  for (let char of text) {
    const codePoint = char.codePointAt(0);
    if (isCodePointInRange(codePoint, HIRAGANA_CONVERSION_RANGE)) {
      char = String.fromCodePoint(codePoint + offset);
    }
    result += char;
  }
  return result;
}


// TODO put everything else in modules!
let JPMN_PAPositions = (function () {

  let my = {};

  ///const ele = document.getElementById("hidden_pa_positions");
  ///const eleOverride = document.getElementById("hidden_pa_override");
  ///const eleDisp = document.getElementById("dh_word_pitch");

  // returns null if cannot find anything
  // otherwise, returns (position (int), dict_name (str))
  // dict_name can be null
  ///function getPosition() {
  ///  let digit = null;

  ///  if (ele === null) {
  ///    return null;
  ///  }

  ///  // first checks pa override
  ///  digit = eleOverride.innerText.match(/\d+/)
  ///  if (digit !== null) {
  ///    return [Number(digit), "override"];
  ///  }

  ///  let searchHTML = null;
  ///  let dictName = null;
  ///  if ((ele.children.length > 0)
  ///      && (ele.children[0] !== null)
  ///      && (ele.children[0].nodeName === "DIV")
  ///      && (ele.children[0].classList.contains("pa-positions__group"))
  ///  ) {
  ///    // stylized by jpmn standards, walks through

  ///    // <div class="pa-positions__group" data-details="NHK">
  ///    //   <div class="pa-positions__dictionary"><div class="pa-positions__dictionary-inner">NHK</div></div>
  ///    //   <ol>
  ///    //     <li>
  ///    //       <span style="display: inline;"><span>[</span><span>1</span><span>]</span></span>
  ///    //     </li>
  ///    //   </ol>
  ///    // </div>
  ///    // ...

  ///    dictName = ele.children[0].getAttribute("data-details");

  ///    // searches for a bolded element
  ///    let first = true;
  ///    let found = false;
  ///    for (let groupDiv of ele.children) {
  ///      for (let liEle of groupDiv.children[1].children) {
  ///        if (first) {
  ///          first = false;
  ///          searchHTML = liEle.innerHTML;
  ///        }
  ///        if (liEle.innerHTML.includes("<b>")) {
  ///          searchHTML = liEle.innerHTML;
  ///          dictName = groupDiv.getAttribute("data-details") + " (bold)";
  ///          found = true;
  ///          break;
  ///        }
  ///      }

  ///      if (found) {
  ///        break;
  ///      }
  ///    }

  ///  } else {
  ///    // just search for any digit in the element
  ///    searchHTML = ele.innerHTML;
  ///  }

  ///  digit = searchHTML.match(/\d+/);
  ///  if (digit === null) {
  ///    return null;
  ///  }

  ///  return [Number(digit), dictName];
  ///}

  // taken directly from anki's implementation of { {kana:...} }
  // https://github.com/ankitects/anki/blob/main/rslib/src/template_filters.rs
  ///function getReadingKana() {
  ///  const readingStr = document.getElementById("hidden_word_reading").innerHTML;

  ///  const re = / ?([^ >]+?)\[(.+?)\]/g

  ///  let result = readingStr.replace(re, "$2");
  ///  //wordReadingRuby = wordReadingRuby.replaceAll(character, `<b>${character}</b>`);

  ///  return result;
  ///}

  function hiraganaAndKatakana(obj) {
    if (Array.isArray(obj)) {
      result = obj.slice(); // shallow copy
      for (let i = 0; i < result.length; i++) {
        result[i] = convertHiraganaToKatakana(result[i]);
      }
      return obj + result;
    }

    return obj + convertHiraganaToKatakana(obj);
  }

  // returns list of indices that contain devoiced mora
  function getDevoiced(moras) {
    let result = [];

    // NOTE: doesn't look for katakana atm
    // ぷ, ぴ apparently has some?
    // ぷ: 潜伏
    // ぴ: 鉛筆
    // ぶ, づ, ず, ぐ, ぢ, じ have none it seems
    // don't know any other Xゅ mora other than しゅ
    let devoiced = hiraganaAndKatakana([..."つすくふぷちしきひぴ"] + ["しゅ"]);
    let devoicedAfter = hiraganaAndKatakana("かきくけこさしすせそたちつてとはひふへほぱぴぷぺぽ");
    let exceptions = hiraganaAndKatakana(["すし"]);

    // 祝福 should be [しゅ]く[ふ]く

    let i = 0;
    while (i < moras.length-1) {
      if (
        moras[i+1] === "っ"
          && devoiced.includes(moras[i])
          && devoicedAfter.includes(moras[i+2])
          && !exceptions.includes(moras[i] + moras[i+2])
        ) {
        result.push(i);

        // skips past the next one because you can't string two devoiced mora together
        i += 3;

      } else if (
          devoiced.includes(moras[i])
          && devoicedAfter.includes(moras[i+1])
          && !exceptions.includes(moras[i] + moras[i+1])
        ) {
        result.push(i);

        // skips past the next one because you can't string two devoiced mora together
        i += 2;

      } else {
        i++;
      }
    }

    return result;
  }

  function convertDevoiced(mora) {
    return `<span class="nopron">${mora}</span>`
  }

  function getNasal(moras) {
    const searchKana = "がぎぐげごガギグゲゴ";

    let result = []

    let i = 1;
    while (i < moras.length) {
      if (searchKana.includes(moras[i])) {
        result.push(i);
      }
      i++;
    }

    return result;
  }

  function convertNasal(mora) {
    const searchKana  = [..."がぎぐげごガギグゲゴ"];
    const replaceKana = "かきくけこカキクケコ";

    let i = searchKana.indexOf(mora)
    let result = replaceKana[i];

    return `${result}<span class="nasal">°</span>`
  }


  function buildReadingSpan(pos, readingKana) {

    // creates div
    const ignoredKana = "ょゅゃョュャ";
    const len = [...readingKana].length;
    if (len === 0) {
      _debug("(JPMN_PAPositions) Reading has length of 0?");
      return;
    }

    // I think the plural of mora is mora, but oh well
    let moras = [];

    let currentPos = 0;
    while (currentPos < len) {
      // checks next kana to see if it's a combined mora (i.e. きょ)
      // ignoredKana.includes(...) <=> ... in ignoredKana
      if (currentPos !== (len-1) && ignoredKana.includes(readingKana[currentPos+1])) {
        moras.push(readingKana.substring(currentPos, currentPos+2));
        currentPos++;
      } else {
        moras.push(readingKana[currentPos])
      }
      currentPos++;
    }

    _debug(`(JPMN_PAPositions) moras: ${moras.join(", ")}`);

    // special case: 0 and length of moras === 1 (nothing needs to be done)
    if (pos === 0 && moras.length === 1) {
      return readingKana;
    }

    let result = moras.slice(); // shallow copy
    const startOverline = '<span class="pitchoverline">';
    const stopOverline = `</span>`;
    const downstep = '<span class="downstep"><span class="downstep-inner">ꜜ</span></span>';


    // TODO devoiced & nasal
    const devoicedIndices = getDevoiced(moras);
    const nasalIndices = getNasal(moras);
    _debug(`(JPMN_PAPositions) devoiced: ${devoicedIndices.join(", ")}`);
    _debug(`(JPMN_PAPositions) nasal: ${nasalIndices.join(", ")}`);
    for (const i of nasalIndices) {
      result[i] = convertNasal(result[i]);
    }
    for (const i of devoicedIndices) {
      result[i] = convertDevoiced(result[i]);
    }

    if (pos === 0) {
      result.splice(1, 0, startOverline); // insert at index 1
      result.push(stopOverline)
    } else if (pos === 1) {
      // start overline starts at the very beginning
      result.splice(pos, 0, stopOverline + downstep);
      result.splice(0, 0, startOverline); // insert at the very beginning
    } else {
      // start overline starts over the 2nd mora
      result.splice(pos, 0, stopOverline + downstep);
      result.splice(1, 0, startOverline); // insert at the very beginning
    }

    result = result.join("");
    return convertHiraganaToKatakana(result);

  }

  function addPosition() {
    const posResult = getPosition();
    if (posResult === null) {
      _debug("(JPMN_PAPositions) Position not found.");
      return;
    }

    const [pos, dictName] = posResult;
    const readingKana = getReadingKana();
    _debug(`(JPMN_PAPositions) pos/dict/reading: ${pos} ${dictName} ${readingKana}`);

    const readingSpanHTML = buildReadingSpan(pos, readingKana);
    _debug(`(JPMN_PAPositions) result html: ${readingSpanHTML}`);
    //eleDisp.innerHTML = readingSpanHTML;
  }

  my.run = addPosition;
  return my;

}());



const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('What is your name ? ', function (name) {
  rl.question('Where do you live ? ', function (country) {
    console.log(`${name}, is a citizen of ${country}`);
    rl.close();
  });
});

rl.on('close', function () {
  console.log('\nBYE BYE !!!');
  process.exit(0);
});


