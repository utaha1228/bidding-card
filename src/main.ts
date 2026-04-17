import "./style.css";
import { appendBid, auctionRows, type AuctionCall } from "./auction";
import { lastContractFromAuction, legalBidsAfter, isBidLegal } from "./bidContext";
import { meaningForStrainCalls } from "./bidMeanings";
import { strainCallsFromAuction } from "./rules/auctionSequence";
import {
  allBids,
  bidAriaLabel,
  formatBid,
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
          if (strain && strain !== "pass") {
            cell.classList.add(`strain-tone--${strain}`);
          } else if (strain === "pass") {
            cell.classList.add("strain-tone--pass", "auction-table__cell--pass");
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

function createBidsPanel(
  getHistory: () => AuctionCall[],
  onPick: (level: number, denom: Denomination) => void,
): { element: HTMLElement; syncLegal: () => void } {
  const section = document.createElement("section");
  section.className = "bids-panel";
  section.setAttribute("aria-label", "All possible bids from one club to seven no trump");

  const title = document.createElement("h2");
  title.className = "bids-panel__title";
  title.textContent = "All bids";
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "bids-grid";
  grid.setAttribute("role", "group");

  for (const { level, denom } of allBids()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.level = String(level);
    btn.dataset.denom = denom;
    btn.className = `bids-grid__cell bids-grid__cell--bid bids-grid__cell--${denom}`;
    btn.textContent = formatBid(level, denom);
    btn.setAttribute("aria-label", bidAriaLabel(level, denom));
    btn.addEventListener("click", () => {
      if (!isBidLegal(getHistory(), level, denom)) return;
      onPick(level, denom);
    });
    grid.appendChild(btn);
  }

  section.appendChild(grid);

  function syncLegal() {
    const h = getHistory();
    for (const btn of grid.querySelectorAll<HTMLButtonElement>("button[data-level][data-denom]")) {
      const level = Number(btn.dataset.level);
      const denom = btn.dataset.denom as Denomination;
      const ok = isBidLegal(h, level, denom);
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
  aside.setAttribute("aria-label", "Current contract and legal next bids");

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
  const curMean = document.createElement("p");
  curMean.className = "bid-context__meaning";
  curWrap.append(curLabel, curMean);
  top.appendChild(curWrap);

  const bottom = document.createElement("div");
  bottom.className = "bid-context__half bid-context__half--next";

  const hNext = document.createElement("h3");
  hNext.className = "bid-context__heading";
  hNext.textContent = "Possible next bids";
  bottom.appendChild(hNext);

  const list = document.createElement("ul");
  list.className = "bid-context__list";
  bottom.appendChild(list);

  aside.append(top, bottom);

  function redraw() {
    const h = getHistory();
    const last = lastContractFromAuction(h);

    curLabel.className = "bid-context__call";
    curMean.textContent = "";

    if (!last) {
      curLabel.textContent = "—";
      curLabel.classList.add("bid-context__call--empty");
      curMean.textContent =
        "No strain bid yet. The next North or South click is an opening call; East and West will pass automatically.";
    } else {
      curLabel.textContent = formatBid(last.level, last.denom);
      curLabel.classList.add(`strain-tone--${last.denom}`);
      curMean.textContent = meaningForStrainCalls(strainCallsFromAuction(h));
    }

    list.replaceChildren();
    const next = legalBidsAfter(h);
    if (next.length === 0) {
      const li = document.createElement("li");
      li.className = "bid-context__list-empty";
      li.textContent = "No higher strain bid exists (auction is already at 7NT).";
      list.appendChild(li);
    } else {
      for (const b of next) {
        const li = document.createElement("li");
        li.className = "bid-context__list-item";

        const call = document.createElement("span");
        call.className = `bid-context__pill strain-tone--${b.denom}`;
        call.textContent = formatBid(b.level, b.denom);

        const mean = document.createElement("p");
        mean.className = "bid-context__list-meaning";
        mean.textContent = meaningForStrainCalls([
          ...strainCallsFromAuction(h),
          { level: b.level, denom: b.denom },
        ]);

        li.append(call, mean);
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

let history: AuctionCall[] = [];
const getHistory = () => history;

function refreshAll() {
  auctionStrip.redraw();
  bidContext.redraw();
  bidsPanel.syncLegal();
}

const auctionStrip = createAuctionStrip(getHistory);
const bidContext = createBidContextPanel(getHistory);
const bidsPanel = createBidsPanel(getHistory, (level, denom) => {
  history = appendBid(history, level, denom);
  refreshAll();
});

pageMain.appendChild(auctionStrip.element);
pageMain.appendChild(bidsPanel.element);

page.appendChild(pageMain);
page.appendChild(bidContext.element);

shell.appendChild(page);
app.appendChild(shell);
