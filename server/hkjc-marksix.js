const HKJC_API_ENDPOINT = 'https://info.cld.hkjc.com/graphql/base/';
const HKJC_RESULTS_URL = 'https://bet.hkjc.com/ch/marksix/results';

const PAST_MARK_SIX_RESULT_QUERY = `
  fragment lotteryDrawsFragment on LotteryDraw {
    id
    year
    no
    openDate
    closeDate
    drawDate
    status
    snowballCode
    snowballName_en
    snowballName_ch
    lotteryPool {
      sell
      status
      totalInvestment
      jackpot
      unitBet
      estimatedPrize
      derivedFirstPrizeDiv
      lotteryPrizes {
        type
        winningUnit
        dividend
      }
    }
    drawResult {
      drawnNo
      xDrawnNo
    }
  }

  query marksixResult(
    $lastNDraw: Int
    $startDate: String
    $endDate: String
    $drawType: LotteryDrawType
  ) {
    lotteryDraws(
      lastNDraw: $lastNDraw
      startDate: $startDate
      endDate: $endDate
      drawType: $drawType
    ) {
      ...lotteryDrawsFragment
    }
  }
`;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function compactPeriod(draw) {
  const year = String(draw.year || '').slice(-2).padStart(2, '0');
  return `${year}/${String(draw.no).padStart(3, '0')}`;
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${Number(match[2])}月${Number(match[3])}日`;
  return String(dateValue);
}

function toIsoDate(dateValue) {
  if (!dateValue) return null;
  const match = String(dateValue).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function normalizeDraw(draw) {
  const main = (draw?.drawResult?.drawnNo || []).map(pad2);
  const special = draw?.drawResult?.xDrawnNo == null ? [] : [pad2(draw.drawResult.xDrawnNo)];
  const raw = { main, special };
   const display = `主码：${main.join(' ')}\n附加号：${special.join(' ')}`;
  return {
    typeId: 'lhc',
    type: '6+1模式',
    period: compactPeriod(draw),
    date: formatDate(draw.drawDate),
    sampleDate: toIsoDate(draw.drawDate),
    raw,
    formatted: `主码:${main.join(',')} 附加号:${special.join(',')}`,
    display,
    parsed: [
      { label: '主码', numbers: main },
      { label: '附加号', numbers: special },
    ],
    numberList: main.concat(special),
    source: 'hkjc.com',
    sourceUrl: HKJC_RESULTS_URL,
    officialId: draw.id,
    status: draw.status,
  };
}

async function fetchMarkSixResults(options = 20) {
  const args = typeof options === 'object' && options !== null ? options : { count: options };
  const safeCount = Math.min(Math.max(Number(args.count) || 20, 1), Number(args.maxCount || 5000));
  const variables = { drawType: 'All' };
  if (args.startDate || args.endDate) {
    variables.startDate = args.startDate;
    variables.endDate = args.endDate;
  } else {
    variables.lastNDraw = safeCount;
  }

  const response = await fetch(HKJC_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': '*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'origin': 'https://bet.hkjc.com',
      'referer': HKJC_RESULTS_URL,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      'sec-fetch-site': 'same-site',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
    },
    body: JSON.stringify({
      query: PAST_MARK_SIX_RESULT_QUERY,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HKJC request failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`HKJC GraphQL error: ${payload.errors.map(err => err.message).join('; ')}`);
  }

  return (payload.data?.lotteryDraws || [])
    .filter(draw => draw?.status === 'Result' && draw?.drawResult?.drawnNo?.length)
    .map(normalizeDraw)
    .slice(0, safeCount);
}

module.exports = { fetchMarkSixResults, normalizeDraw, HKJC_RESULTS_URL };
