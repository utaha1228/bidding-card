import "./style.css";
import { appendCall, auctionRows, upcomingWind, undoLastCall, type AuctionCall } from "./auction";
import {
  legalBidsAfter,
  legalNonStrainCalls,
  isCallLegal,
} from "./bidContext";
import { meaningsForAuctionHistory } from "./bidMeanings";
import {
  allBids,
  bidAriaLabel,
  formatBid,
  parseBidLabel,
  strainFromCallText,
  type Denomination,
} from "./bidding";

function createAuctionStrip(getHistory: () => AuctionCall[]): {
  element: HTMLElement;
  redraw: () => void;
} {
  const wrap = document.createElement("section");
  wrap.className = "auction-strip";
  wrap.setAttribute("aria-label", "Auction so far");

  const title = document.createElement("h2");
  title.className = "auction-strip__title";
  title.textContent = "Bidding";
  wrap.appendChild(title);

  const table = document.createElement("div");
  table.className = "auction-table";
  table.setAttribute("role", "table");

  const headerRow = document.createElement("div");
  headerRow.className = "auction-table__row auction-table__row--head";
  headerRow.setAttribute("role", "row");
  for (const w of ["N", "E", "S", "W"] as const) {
    const th = document.createElement("div");
    th.className = "auction-table__cell auction-table__cell--head";
    th.setAttribute("role", "columnheader");
    th.textContent = w;
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  const body = document.createElement("div");
  body.className = "auction-table__body";
  body.setAttribute("role", "rowgroup");

  function redraw() {
    body.replaceChildren();
    const history = getHistory();
    const rows = auctionRows(history, 1);
    for (let r = 0; r < rows.length; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "auction-table__row";
      rowEl.setAttribute("role", "row");
      for (let c = 0; c < 4; c++) {
        const cell = document.createElement("div");
        const idx = r * 4 + c;
        const text = rows[r]![c]!;
        cell.className = "auction-table__cell";
        if (idx >= history.length) {
          cell.classList.add("auction-table__cell--placeholder");
        } else {
          const call = history[idx]!;
          const strain = strainFromCallText(call.text);
          if (strain && strain !== "pass" && strain !== "double" && strain !== "redouble") {
            cell.classList.add(`strain-tone--${strain}`);
          } else if (strain === "pass") {
            cell.classList.add("strain-tone--pass", "auction-table__cell--pass");
          } else if (strain === "double") {
            cell.classList.add("strain-tone--double", "auction-table__cell--conventional");
          } else if (strain === "redouble") {
            cell.classList.add("strain-tone--redouble", "auction-table__cell--conventional");
          }
        }
        cell.setAttribute("role", "cell");
        cell.textContent = text;
        rowEl.appendChild(cell);
      }
      body.appendChild(rowEl);
    }
  }

  table.appendChild(body);
  wrap.appendChild(table);

  redraw();
  return { element: wrap, redraw };
}

const SPECIAL_CALLS: { text: "Pass" | "Double" | "Redouble"; aria: string; className: string }[] = [
  { text: "Pass", aria: "Pass", className: "bids-grid__cell--pass-call" },
  { text: "Double", aria: "Double", className: "bids-grid__cell--double-call" },
  { text: "Redouble", aria: "Redouble", className: "bids-grid__cell--redouble-call" },
];

function createBidsPanel(
  getHistory: () => AuctionCall[],
  onPickCall: (text: string) => void,
): { element: HTMLElement; syncLegal: () => void } {
  const section = document.createElement("section");
  section.className = "bids-panel";
  section.setAttribute(
    "aria-label",
    "Strain bids from one club through seven no trump, plus pass, double, and redouble",
  );

  const title = document.createElement("h2");
  title.className = "bids-panel__title";
  title.textContent = "Calls";
  section.appendChild(title);

  const callRow = document.createElement("div");
  callRow.className = "bids-call-row";
  callRow.setAttribute("role", "group");
  callRow.setAttribute("aria-label", "Pass, double, and redouble");

  for (const spec of SPECIAL_CALLS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.call = spec.text;
    btn.className = `bids-grid__cell bids-grid__cell--bid bids-call-row__btn ${spec.className}`;
    btn.textContent = spec.text;
    btn.setAttribute("aria-label", spec.aria);
    btn.addEventListener("click", () => {
      if (!isCallLegal(getHistory(), spec.text)) return;
      onPickCall(spec.text);
    });
    callRow.appendChild(btn);
  }
  section.appendChild(callRow);

  const grid = document.createElement("div");
  grid.className = "bids-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "Strain bids one club through seven no trump");

  for (const { level, denom } of allBids()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.level = String(level);
    btn.dataset.denom = denom;
    btn.className = `bids-grid__cell bids-grid__cell--bid bids-grid__cell--${denom}`;
    btn.textContent = formatBid(level, denom);
    btn.setAttribute("aria-label", bidAriaLabel(level, denom));
    btn.addEventListener("click", () => {
      const text = formatBid(level, denom);
      if (!isCallLegal(getHistory(), text)) return;
      onPickCall(text);
    });
    grid.appendChild(btn);
  }

  section.appendChild(grid);

  function syncLegal() {
    const h = getHistory();
    for (const btn of section.querySelectorAll<HTMLButtonElement>("button[data-level][data-denom]")) {
      const level = Number(btn.dataset.level);
      const denom = btn.dataset.denom as Denomination;
      const ok = isCallLegal(h, formatBid(level, denom));
      btn.disabled = !ok;
      btn.classList.toggle("bids-grid__cell--illegal", !ok);
    }
    for (const btn of section.querySelectorAll<HTMLButtonElement>("button[data-call]")) {
      const text = btn.dataset.call!;
      const ok = isCallLegal(h, text);
      btn.disabled = !ok;
      btn.classList.toggle("bids-grid__cell--illegal", !ok);
    }
  }

  syncLegal();
  return { element: section, syncLegal };
}

function createBidContextPanel(getHistory: () => AuctionCall[]): {
  element: HTMLElement;
  redraw: () => void;
} {
  const aside = document.createElement("aside");
  aside.className = "bid-context";
  aside.setAttribute(
    "aria-label",
    "Current contract and next calls; strain bids listed only when bidding rules match",
  );

  const top = document.createElement("div");
  top.className = "bid-context__half bid-context__half--current";

  const hCur = document.createElement("h3");
  hCur.className = "bid-context__heading";
  hCur.textContent = "Current bid";
  top.appendChild(hCur);

  const curWrap = document.createElement("div");
  curWrap.className = "bid-context__call-wrap";
  const curLabel = document.createElement("p");
  curLabel.className = "bid-context__call";
  const curMeanings = document.createElement("div");
  curMeanings.className = "bid-context__meanings";
  curWrap.append(curLabel, curMeanings);
  top.appendChild(curWrap);

  const bottom = document.createElement("div");
  bottom.className = "bid-context__half bid-context__half--next";

  const hNext = document.createElement("h3");
  hNext.className = "bid-context__heading";
  hNext.textContent = "Possible next calls";
  hNext.title =
    "All bids that are defined in the bidding card";
  bottom.appendChild(hNext);

  const list = document.createElement("ul");
  list.className = "bid-context__list";
  bottom.appendChild(list);

  aside.append(top, bottom);

  function redraw() {
    const h = getHistory();

    curLabel.className = "bid-context__call";
    curMeanings.replaceChildren();

    if (h.length === 0) {
      curLabel.textContent = "—";
      curLabel.classList.add("bid-context__call--empty");
    } else {
      const last = h[h.length - 1].text;
      curLabel.textContent = last;
      if (last === 'Pass' || last === 'Double' || last == 'Redouble') {
        curLabel.classList.add(`strain-tone--${last.toLowerCase()}`);
      }
      else {
        const bid = parseBidLabel(last);
        if (bid) {
          curLabel.classList.add(`strain-tone--${bid.denom}`);
        }
        else{
          console.log(last);
        }
      }

      if (last !== 'Pass') {
        for (const line of meaningsForAuctionHistory(h)) {
          const p = document.createElement("p");
          p.className = "bid-context__meaning-block";
          p.textContent = line;
          curMeanings.appendChild(p);
        }
      }
    }

    list.replaceChildren();

    const extras = legalNonStrainCalls(h)
      .map((b) => ({
        bid: b,
        lines: meaningsForAuctionHistory([
          ...h,
          { wind: upcomingWind(h), text: b },
        ]),
      }))
      .filter((x) => (x.lines.length > 0) && (x.bid !== 'Pass'));
  
    const pillClass: Record<"Pass" | "Double" | "Redouble", string> = {
      Pass: "bid-context__pill strain-tone--pass",
      Double: "bid-context__pill strain-tone--double",
      Redouble: "bid-context__pill strain-tone--redouble",
    };

    for (const { bid: b, lines } of extras) {
      const li = document.createElement("li");
      li.className = "bid-context__list-item";
      const call = document.createElement("span");
      call.className = pillClass[b];
      call.textContent = b;
      li.appendChild(call);
      list.appendChild(li);

      for (const line of lines) {
        const mean = document.createElement("p");
        mean.className = "bid-context__list-meaning";
        mean.textContent = line;
        li.appendChild(mean);
      }

      list.appendChild(li);
    }

    const legalStrain = legalBidsAfter(h);
    const nextWithRules = legalStrain
      .map((b) => ({
        bid: b,
        lines: meaningsForAuctionHistory([
          ...h,
          { wind: upcomingWind(h), text: formatBid(b.level, b.denom) },
        ]),
      }))
      .filter((x) => x.lines.length > 0);

    if (legalStrain.length === 0) {
      const li = document.createElement("li");
      li.className = "bid-context__list-empty";
      li.textContent = "No higher strain bid exists (auction is already at 7NT).";
      list.appendChild(li);
    } else {
      for (const { bid: b, lines } of nextWithRules) {
        const li = document.createElement("li");
        li.className = "bid-context__list-item";

        const call = document.createElement("span");
        call.className = `bid-context__pill strain-tone--${b.denom}`;
        call.textContent = formatBid(b.level, b.denom);
        li.appendChild(call);

        for (const line of lines) {
          const mean = document.createElement("p");
          mean.className = "bid-context__list-meaning";
          mean.textContent = line;
          li.appendChild(mean);
        }

        list.appendChild(li);
      }
    }
  }

  redraw();
  return { element: aside, redraw };
}

const app = document.querySelector<HTMLDivElement>("#app")!;

const shell = document.createElement("div");
shell.className = "shell";

const page = document.createElement("div");
page.className = "page";

const pageMain = document.createElement("div");
pageMain.className = "page__main";

const h1 = document.createElement("h1");
h1.textContent = "Bridge bidding card";
pageMain.appendChild(h1);

const auctionToolbar = document.createElement("div");
auctionToolbar.className = "auction-toolbar";
auctionToolbar.setAttribute("aria-label", "Auction history controls");

const btnUndo = document.createElement("button");
btnUndo.type = "button";
btnUndo.className = "auction-toolbar__btn";
btnUndo.textContent = "Undo";
btnUndo.setAttribute("aria-label", "Remove the last call from the auction");
btnUndo.disabled = true;

const btnClear = document.createElement("button");
btnClear.type = "button";
btnClear.className = "auction-toolbar__btn";
btnClear.textContent = "Clear auction";
btnClear.setAttribute("aria-label", "Clear the entire bidding sequence");
btnClear.disabled = true;

auctionToolbar.append(btnUndo, btnClear);
pageMain.appendChild(auctionToolbar);

let history: AuctionCall[] = [];
const getHistory = () => history;

const auctionStrip = createAuctionStrip(getHistory);
const bidContext = createBidContextPanel(getHistory);
const bidsPanel = createBidsPanel(getHistory, (text) => {
  history = appendCall(history, text);
  refreshAll();
});

function refreshAll() {
  auctionStrip.redraw();
  bidContext.redraw();
  bidsPanel.syncLegal();
  btnUndo.disabled = history.length === 0;
  btnClear.disabled = history.length === 0;
}

btnUndo.addEventListener("click", () => {
  if (history.length === 0) return;
  history = undoLastCall(history);
  refreshAll();
});

btnClear.addEventListener("click", () => {
  if (history.length === 0) return;
  history = [];
  refreshAll();
});

pageMain.appendChild(auctionStrip.element);
pageMain.appendChild(bidsPanel.element);

page.appendChild(pageMain);
page.appendChild(bidContext.element);

shell.appendChild(page);
app.appendChild(shell);
