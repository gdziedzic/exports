// FIX Parser - Comprehensive FIX Protocol Parser
// Enhanced with repeating groups, message builder, session log analysis, and export features

// ============================================================================
// FIX DATA DICTIONARY
// ============================================================================

const FIX_FIELDS = {
  // Header fields
  8: { name: 'BeginString', description: 'FIX protocol version (e.g., FIX.4.2, FIX.4.4)', category: 'header' },
  9: { name: 'BodyLength', description: 'Message length in bytes (excluding header and trailer)', category: 'header' },
  35: { name: 'MsgType', description: 'Message type (e.g., D=New Order, 8=Execution Report)', category: 'header' },
  49: { name: 'SenderCompID', description: 'Sender company ID', category: 'header' },
  56: { name: 'TargetCompID', description: 'Target company ID', category: 'header' },
  34: { name: 'MsgSeqNum', description: 'Message sequence number', category: 'header' },
  52: { name: 'SendingTime', description: 'Time of message transmission (YYYYMMDD-HH:MM:SS)', category: 'header' },
  10: { name: 'CheckSum', description: 'Three-byte checksum (calculated on entire message)', category: 'trailer' },

  // Common order fields
  11: { name: 'ClOrdID', description: 'Client Order ID (unique per order)', category: 'order' },
  14: { name: 'CumQty', description: 'Total quantity filled', category: 'execution' },
  15: { name: 'Currency', description: 'Currency code (ISO 4217, e.g., USD, EUR)', category: 'order' },
  17: { name: 'ExecID', description: 'Execution ID (unique per execution)', category: 'execution' },
  18: { name: 'ExecInst', description: 'Execution instructions', category: 'order' },
  19: { name: 'ExecRefID', description: 'Reference execution ID', category: 'execution' },
  20: { name: 'ExecTransType', description: 'Execution transaction type (0=New, 1=Cancel, 2=Correct, 3=Status)', category: 'execution' },
  21: { name: 'HandlInst', description: 'Handling instructions (1=Auto private, 2=Auto public, 3=Manual)', category: 'order' },
  22: { name: 'SecurityIDSource', description: 'Security identifier source (1=CUSIP, 2=SEDOL, 4=ISIN, 8=Exchange)', category: 'instrument' },
  30: { name: 'LastMkt', description: 'Market of execution', category: 'execution' },
  31: { name: 'LastPx', description: 'Price of last fill', category: 'execution' },
  32: { name: 'LastQty', description: 'Quantity of last fill', category: 'execution' },
  36: { name: 'NewSeqNo', description: 'New sequence number', category: 'session' },
  37: { name: 'OrderID', description: 'Unique order ID assigned by broker/exchange', category: 'order' },
  38: { name: 'OrderQty', description: 'Quantity ordered', category: 'order' },
  39: { name: 'OrdStatus', description: 'Order status (0=New, 1=Partial, 2=Filled, 4=Canceled, 8=Rejected)', category: 'order' },
  40: { name: 'OrdType', description: 'Order type (1=Market, 2=Limit, 3=Stop, 4=Stop Limit)', category: 'order' },
  41: { name: 'OrigClOrdID', description: 'Original Client Order ID (for cancel/replace)', category: 'order' },
  42: { name: 'OrigTime', description: 'Original time of message', category: 'session' },
  43: { name: 'PossDupFlag', description: 'Possible duplicate flag (Y/N)', category: 'session' },
  44: { name: 'Price', description: 'Price per unit (limit price for limit orders)', category: 'order' },
  45: { name: 'RefSeqNum', description: 'Reference sequence number', category: 'session' },
  47: { name: 'Rule80A', description: 'Rule 80A (NYSE) - order capacity', category: 'order' },
  48: { name: 'SecurityID', description: 'Security identifier (CUSIP, ISIN, etc.)', category: 'instrument' },
  50: { name: 'SenderSubID', description: 'Sender sub-identifier', category: 'header' },
  54: { name: 'Side', description: 'Side of order (1=Buy, 2=Sell, 3=Buy minus, 4=Sell plus)', category: 'order' },
  55: { name: 'Symbol', description: 'Ticker symbol', category: 'instrument' },
  57: { name: 'TargetSubID', description: 'Target sub-identifier', category: 'header' },
  58: { name: 'Text', description: 'Free text field for comments/errors', category: 'common' },
  59: { name: 'TimeInForce', description: 'Time in force (0=Day, 1=GTC, 2=OPG, 3=IOC, 4=FOK, 6=GTD)', category: 'order' },
  60: { name: 'TransactTime', description: 'Transaction time (YYYYMMDD-HH:MM:SS)', category: 'common' },
  63: { name: 'SettlType', description: 'Settlement type (0=Regular, 1=Cash, 2=Next Day)', category: 'settlement' },
  64: { name: 'SettlDate', description: 'Settlement date (YYYYMMDD)', category: 'settlement' },
  65: { name: 'SymbolSfx', description: 'Symbol suffix', category: 'instrument' },
  76: { name: 'ExecBroker', description: 'Executing broker', category: 'execution' },
  77: { name: 'OpenClose', description: 'Open/Close indicator (O=Open, C=Close)', category: 'order' },
  78: { name: 'NoAllocs', description: 'Number of allocation groups (repeating group)', category: 'allocation', repeatingGroup: true },
  79: { name: 'AllocAccount', description: 'Allocation account', category: 'allocation' },
  80: { name: 'AllocQty', description: 'Allocation quantity', category: 'allocation' },
  98: { name: 'EncryptMethod', description: 'Encryption method (0=None, 1=PKCS, 2=DES, 3=PKCS-DES)', category: 'session' },
  99: { name: 'StopPx', description: 'Stop price for stop orders', category: 'order' },
  100: { name: 'ExDestination', description: 'Execution destination (exchange MIC code)', category: 'order' },
  102: { name: 'CxlRejReason', description: 'Cancel reject reason (0=Too late, 1=Unknown order, 2=Broker option)', category: 'order' },
  103: { name: 'OrdRejReason', description: 'Order rejection reason (0=Broker, 1=Unknown symbol, 2=Exchange closed)', category: 'order' },
  108: { name: 'HeartBtInt', description: 'Heartbeat interval in seconds', category: 'session' },
  109: { name: 'ClientID', description: 'Client ID', category: 'party' },
  110: { name: 'MinQty', description: 'Minimum quantity for execution', category: 'order' },
  111: { name: 'MaxFloor', description: 'Maximum floor quantity (iceberg orders)', category: 'order' },
  112: { name: 'TestReqID', description: 'Test request ID (for Test Request message)', category: 'session' },
  115: { name: 'OnBehalfOfCompID', description: 'On behalf of company ID', category: 'party' },
  116: { name: 'OnBehalfOfSubID', description: 'On behalf of sub-ID', category: 'party' },
  117: { name: 'QuoteID', description: 'Quote ID', category: 'quote' },
  122: { name: 'OrigSendingTime', description: 'Original sending time (for PossDup=Y)', category: 'session' },
  123: { name: 'GapFillFlag', description: 'Gap fill flag (Y/N) for Sequence Reset', category: 'session' },
  126: { name: 'ExpireTime', description: 'Expiration time for orders (YYYYMMDD-HH:MM:SS)', category: 'order' },
  128: { name: 'DeliverToCompID', description: 'Deliver to company ID', category: 'party' },
  129: { name: 'DeliverToSubID', description: 'Deliver to sub-ID', category: 'party' },
  131: { name: 'QuoteReqID', description: 'Quote request ID', category: 'quote' },
  132: { name: 'BidPx', description: 'Bid price', category: 'quote' },
  133: { name: 'OfferPx', description: 'Offer price', category: 'quote' },
  134: { name: 'BidSize', description: 'Bid size', category: 'quote' },
  135: { name: 'OfferSize', description: 'Offer size', category: 'quote' },
  136: { name: 'NoMiscFees', description: 'Number of miscellaneous fees (repeating group)', category: 'fees', repeatingGroup: true },
  137: { name: 'MiscFeeAmt', description: 'Miscellaneous fee amount', category: 'fees' },
  138: { name: 'MiscFeeCurr', description: 'Miscellaneous fee currency', category: 'fees' },
  139: { name: 'MiscFeeType', description: 'Miscellaneous fee type', category: 'fees' },
  140: { name: 'PrevClosePx', description: 'Previous closing price', category: 'market' },
  141: { name: 'ResetSeqNumFlag', description: 'Reset sequence number flag (Y/N)', category: 'session' },
  142: { name: 'SenderLocationID', description: 'Sender location ID', category: 'party' },
  143: { name: 'TargetLocationID', description: 'Target location ID', category: 'party' },
  144: { name: 'OnBehalfOfLocationID', description: 'On behalf of location ID', category: 'party' },
  145: { name: 'DeliverToLocationID', description: 'Deliver to location ID', category: 'party' },
  146: { name: 'NoRelatedSym', description: 'Number of related symbols (repeating group)', category: 'instrument', repeatingGroup: true },
  147: { name: 'Subject', description: 'Subject of email message', category: 'email' },
  148: { name: 'Headline', description: 'Headline for news', category: 'news' },
  149: { name: 'URLLink', description: 'URL link', category: 'common' },
  150: { name: 'ExecType', description: 'Execution type (0=New, 1=Partial, 2=Fill, 4=Canceled, 8=Rejected)', category: 'execution' },
  151: { name: 'LeavesQty', description: 'Quantity still open for execution', category: 'order' },
  152: { name: 'CashOrderQty', description: 'Cash order quantity (for mutual funds)', category: 'order' },
  167: { name: 'SecurityType', description: 'Security type (e.g., FUT, OPT, CS, MLEG)', category: 'instrument' },
  168: { name: 'EffectiveTime', description: 'Effective time', category: 'common' },
  200: { name: 'MaturityMonthYear', description: 'Maturity month and year (YYYYMM or YYYYMMDD)', category: 'instrument' },
  201: { name: 'PutOrCall', description: 'Put or Call (0=Put, 1=Call)', category: 'instrument' },
  202: { name: 'StrikePrice', description: 'Strike price for options', category: 'instrument' },
  207: { name: 'SecurityExchange', description: 'Security exchange (MIC code)', category: 'instrument' },
  211: { name: 'PegOffsetValue', description: 'Peg offset value for pegged orders', category: 'order' },
  262: { name: 'MDReqID', description: 'Market data request ID', category: 'market-data' },
  263: { name: 'SubscriptionRequestType', description: 'Subscription request type (0=Snapshot, 1=Subscribe, 2=Unsubscribe)', category: 'market-data' },
  264: { name: 'MarketDepth', description: 'Market depth (0=Full book, 1=Top of book, N=N levels)', category: 'market-data' },
  265: { name: 'MDUpdateType', description: 'Market data update type (0=Full, 1=Incremental)', category: 'market-data' },
  266: { name: 'AggregatedBook', description: 'Aggregated book flag (Y/N)', category: 'market-data' },
  267: { name: 'NoMDEntryTypes', description: 'Number of market data entry types (repeating group)', category: 'market-data', repeatingGroup: true },
  268: { name: 'NoMDEntries', description: 'Number of market data entries (repeating group)', category: 'market-data', repeatingGroup: true },
  269: { name: 'MDEntryType', description: 'Market data entry type (0=Bid, 1=Offer, 2=Trade, 4=Open, 7=High, 8=Low)', category: 'market-data' },
  270: { name: 'MDEntryPx', description: 'Market data entry price', category: 'market-data' },
  271: { name: 'MDEntrySize', description: 'Market data entry size (quantity)', category: 'market-data' },
  272: { name: 'MDEntryDate', description: 'Market data entry date (YYYYMMDD)', category: 'market-data' },
  273: { name: 'MDEntryTime', description: 'Market data entry time (HH:MM:SS)', category: 'market-data' },
  274: { name: 'TickDirection', description: 'Tick direction (0=Plus, 1=Zero-Plus, 2=Minus, 3=Zero-Minus)', category: 'market-data' },
  276: { name: 'QuoteCondition', description: 'Quote condition', category: 'quote' },
  277: { name: 'TradeCondition', description: 'Trade condition', category: 'execution' },
  278: { name: 'MDEntryID', description: 'Market data entry ID', category: 'market-data' },
  279: { name: 'MDUpdateAction', description: 'Market data update action (0=New, 1=Change, 2=Delete)', category: 'market-data' },
  280: { name: 'MDEntryRefID', description: 'Market data entry reference ID', category: 'market-data' },
  336: { name: 'TradingSessionID', description: 'Trading session ID', category: 'trading-session' },
  372: { name: 'RefMsgType', description: 'Reference message type (for Reject messages)', category: 'session' },
  373: { name: 'SessionRejectReason', description: 'Session reject reason (0=Invalid tag, 1=Required tag missing, 5=Value incorrect)', category: 'session' },
  375: { name: 'ContraBroker', description: 'Contra broker', category: 'execution' },
  378: { name: 'ExecRestatementReason', description: 'Execution restatement reason', category: 'execution' },
  380: { name: 'BusinessRejectRefID', description: 'Business reject reference ID', category: 'session' },
  381: { name: 'BusinessRejectReason', description: 'Business reject reason', category: 'session' },
  382: { name: 'NoContraBrokers', description: 'Number of contra brokers (repeating group)', category: 'execution', repeatingGroup: true },
  383: { name: 'MaxMessageSize', description: 'Maximum message size in bytes', category: 'session' },
  384: { name: 'NoMsgTypes', description: 'Number of message types (repeating group)', category: 'session', repeatingGroup: true },
  434: { name: 'CxlRejResponseTo', description: 'Cancel reject response to (1=Order Cancel Request, 2=Order Cancel/Replace)', category: 'order' },
  447: { name: 'PartyIDSource', description: 'Party ID source', category: 'party' },
  448: { name: 'PartyID', description: 'Party ID', category: 'party' },
  452: { name: 'PartyRole', description: 'Party role (1=Executing Firm, 3=Client ID, 4=Clearing Firm)', category: 'party' },
  453: { name: 'NoPartyIDs', description: 'Number of party IDs (repeating group)', category: 'party', repeatingGroup: true },
  460: { name: 'Product', description: 'Product (1=AGENCY, 2=COMMODITY, 3=CORPORATE, 4=CURRENCY)', category: 'instrument' },
  461: { name: 'CFICode', description: 'CFI code (ISO 10962)', category: 'instrument' },
  528: { name: 'OrderCapacity', description: 'Order capacity (A=Agency, G=Proprietary, I=Individual, P=Principal)', category: 'order' },
  533: { name: 'Username', description: 'Username for authentication', category: 'session' },
  554: { name: 'Password', description: 'Password for authentication', category: 'session' },
  555: { name: 'NoLegs', description: 'Number of legs (repeating group for multileg instruments)', category: 'instrument', repeatingGroup: true },
  600: { name: 'LegSymbol', description: 'Leg symbol (multileg)', category: 'instrument' },
  601: { name: 'LegSymbolSfx', description: 'Leg symbol suffix (multileg)', category: 'instrument' },
  602: { name: 'LegSecurityID', description: 'Leg security ID (multileg)', category: 'instrument' },
  603: { name: 'LegSecurityIDSource', description: 'Leg security ID source (multileg)', category: 'instrument' },
  625: { name: 'TradingSessionID', description: 'Trading session ID', category: 'trading-session' },
  631: { name: 'MidPx', description: 'Mid price', category: 'market' },
  636: { name: 'WorkingIndicator', description: 'Working indicator (Y/N)', category: 'order' },
  1128: { name: 'ApplVerID', description: 'Application version ID', category: 'session' },
  1129: { name: 'ApplExtID', description: 'Application extension ID', category: 'session' },
};

const MSG_TYPES = {
  '0': 'Heartbeat',
  '1': 'Test Request',
  '2': 'Resend Request',
  '3': 'Reject',
  '4': 'Sequence Reset',
  '5': 'Logout',
  '8': 'Execution Report',
  '9': 'Order Cancel Reject',
  'A': 'Logon',
  'D': 'New Order - Single',
  'F': 'Order Cancel Request',
  'G': 'Order Cancel/Replace Request',
  'H': 'Order Status Request',
  'J': 'Allocation Instruction',
  'K': 'List Cancel Request',
  'L': 'List Execute',
  'M': 'List Status Request',
  'N': 'List Status',
  'P': 'Allocation Instruction Ack',
  'Q': 'Dont Know Trade',
  'R': 'Quote Request',
  'S': 'Quote',
  'V': 'Market Data Request',
  'W': 'Market Data - Snapshot/Full Refresh',
  'X': 'Market Data - Incremental Refresh',
  'Y': 'Market Data Request Reject',
  'Z': 'Quote Cancel',
  'a': 'Quote Status Request',
  'b': 'Mass Quote Acknowledgement',
  'c': 'Security Definition Request',
  'd': 'Security Definition',
  'e': 'Security Status Request',
  'f': 'Security Status',
  'g': 'Trading Session Status Request',
  'h': 'Trading Session Status',
  'i': 'Mass Quote',
  'j': 'Business Message Reject',
  'k': 'Bid Request',
  'l': 'Bid Response',
};

// Repeating group definitions
const REPEATING_GROUPS = {
  78: { name: 'Allocations', fields: [79, 80, 81] },
  136: { name: 'Miscellaneous Fees', fields: [137, 138, 139] },
  146: { name: 'Related Symbols', fields: [55, 65, 48, 22, 167, 200, 201, 202, 207] },
  267: { name: 'MD Entry Types', fields: [269] },
  268: { name: 'MD Entries', fields: [269, 270, 271, 272, 273, 274, 276, 277, 278, 279, 280] },
  382: { name: 'Contra Brokers', fields: [375] },
  453: { name: 'Party IDs', fields: [448, 447, 452] },
  555: { name: 'Legs', fields: [600, 601, 602, 603] },
};

// Field validation rules
const VALIDATION_RULES = {
  9: { type: 'number', name: 'BodyLength' },
  14: { type: 'number', name: 'CumQty' },
  31: { type: 'price', name: 'LastPx' },
  32: { type: 'number', name: 'LastQty' },
  34: { type: 'number', name: 'MsgSeqNum' },
  38: { type: 'number', name: 'OrderQty' },
  44: { type: 'price', name: 'Price' },
  99: { type: 'price', name: 'StopPx' },
  108: { type: 'number', name: 'HeartBtInt' },
  110: { type: 'number', name: 'MinQty' },
  111: { type: 'number', name: 'MaxFloor' },
  132: { type: 'price', name: 'BidPx' },
  133: { type: 'price', name: 'OfferPx' },
  134: { type: 'number', name: 'BidSize' },
  135: { type: 'number', name: 'OfferSize' },
  151: { type: 'number', name: 'LeavesQty' },
  152: { type: 'number', name: 'CashOrderQty' },
  202: { type: 'price', name: 'StrikePrice' },
  268: { type: 'number', name: 'NoMDEntries' },
  270: { type: 'price', name: 'MDEntryPx' },
  271: { type: 'number', name: 'MDEntrySize' },
  20: { type: 'enum', name: 'ExecTransType', values: ['0', '1', '2', '3'] },
  21: { type: 'enum', name: 'HandlInst', values: ['1', '2', '3'] },
  39: { type: 'enum', name: 'OrdStatus', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E'] },
  40: { type: 'enum', name: 'OrdType', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'] },
  43: { type: 'enum', name: 'PossDupFlag', values: ['Y', 'N'] },
  54: { type: 'enum', name: 'Side', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C'] },
  59: { type: 'enum', name: 'TimeInForce', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] },
  63: { type: 'enum', name: 'SettlType', values: ['0', '1', '2', '3', '4', '5'] },
  77: { type: 'enum', name: 'OpenClose', values: ['O', 'C'] },
  98: { type: 'enum', name: 'EncryptMethod', values: ['0', '1', '2', '3', '4', '5', '6'] },
  123: { type: 'enum', name: 'GapFillFlag', values: ['Y', 'N'] },
  141: { type: 'enum', name: 'ResetSeqNumFlag', values: ['Y', 'N'] },
  150: { type: 'enum', name: 'ExecType', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] },
  201: { type: 'enum', name: 'PutOrCall', values: ['0', '1'] },
  263: { type: 'enum', name: 'SubscriptionRequestType', values: ['0', '1', '2'] },
  269: { type: 'enum', name: 'MDEntryType', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C'] },
  279: { type: 'enum', name: 'MDUpdateAction', values: ['0', '1', '2'] },
  52: { type: 'timestamp', name: 'SendingTime' },
  60: { type: 'timestamp', name: 'TransactTime' },
  64: { type: 'date', name: 'SettlDate' },
  122: { type: 'timestamp', name: 'OrigSendingTime' },
  126: { type: 'timestamp', name: 'ExpireTime' },
  168: { type: 'timestamp', name: 'EffectiveTime' },
  272: { type: 'date', name: 'MDEntryDate' },
  10: { type: 'checksum', name: 'CheckSum' }
};

// Function to calculate checksum
function calculateChecksum(messageBeforeChecksum) {
  let sum = 0;
  for (let i = 0; i < messageBeforeChecksum.length; i++) {
    sum += messageBeforeChecksum.charCodeAt(i);
  }
  return (sum % 256).toString().padStart(3, '0');
}

// Sample messages with CORRECT checksums
const SAMPLE_MESSAGES = {
  'logon': '8=FIX.4.2|9=96|35=A|49=SENDER|56=TARGET|34=1|52=20240115-08:00:00|98=0|108=30|553=USERNAME|554=PASSWORD|10=223|',
  'new-order': '8=FIX.4.2|9=154|35=D|49=SENDER|56=TARGET|34=1|52=20240115-12:30:00|11=ORDER123|21=1|55=AAPL|54=1|60=20240115-12:30:00|38=100|40=2|44=150.50|59=0|10=033|',
  'execution-report': '8=FIX.4.2|9=221|35=8|49=TARGET|56=SENDER|34=2|52=20240115-12:30:05|11=ORDER123|17=EXEC001|37=ORD456|39=2|54=1|55=AAPL|150=2|151=0|14=100|38=100|31=150.50|32=100|60=20240115-12:30:05|10=175|',
  'market-data-request': '8=FIX.4.2|9=121|35=V|49=SENDER|56=TARGET|34=3|52=20240115-13:00:00|262=MDREQ001|263=1|264=0|265=0|146=1|55=MSFT|267=2|269=0|269=1|10=086|',
  'market-data-snapshot': '8=FIX.4.2|9=174|35=W|49=TARGET|56=SENDER|34=4|52=20240115-13:00:01|55=MSFT|262=MDREQ001|268=2|269=0|270=385.25|271=1000|269=1|270=385.50|271=800|10=039|',
  'order-cancel': '8=FIX.4.2|9=132|35=F|49=SENDER|56=TARGET|34=5|52=20240115-14:00:00|11=CANCEL001|41=ORDER123|55=AAPL|54=1|60=20240115-14:00:00|10=028|',
  'order-cancel-replace': '8=FIX.4.2|9=165|35=G|49=SENDER|56=TARGET|34=6|52=20240115-14:15:00|11=REPLACE001|41=ORDER123|55=AAPL|54=1|60=20240115-14:15:00|38=200|40=2|44=151.00|59=0|10=056|',
  'reject': '8=FIX.4.2|9=112|35=3|49=TARGET|56=SENDER|34=7|52=20240115-15:00:00|45=5|373=1|58=Required tag missing|372=D|10=089|',
  'session-log': `8=FIX.4.2|9=96|35=A|49=SENDER|56=TARGET|34=1|52=20240115-08:00:00|98=0|108=30|553=USERNAME|554=PASSWORD|10=223|
8=FIX.4.2|9=154|35=D|49=SENDER|56=TARGET|34=2|52=20240115-12:30:00|11=ORDER123|21=1|55=AAPL|54=1|60=20240115-12:30:00|38=100|40=2|44=150.50|59=0|10=034|
8=FIX.4.2|9=221|35=8|49=TARGET|56=SENDER|34=3|52=20240115-12:30:05|11=ORDER123|17=EXEC001|37=ORD456|39=2|54=1|55=AAPL|150=2|151=0|14=100|38=100|31=150.50|32=100|60=20240115-12:30:05|10=176|
8=FIX.4.2|9=132|35=F|49=SENDER|56=TARGET|34=4|52=20240115-14:00:00|11=CANCEL001|41=ORDER123|55=AAPL|54=1|60=20240115-14:00:00|10=027|`
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let parsedData = null;
let sessionMessages = [];
let elements = {};

// ============================================================================
// CORE PARSING FUNCTIONS
// ============================================================================

function getDelimiter(message, selected) {
  if (selected === 'auto') {
    if (message.includes('|')) return '|';
    if (message.includes('\x01') || message.includes('^A')) return '\x01';
    return '|';
  }
  return selected === 'SOH' ? '\x01' : selected;
}

function parseFIXMessage(message, delimiter) {
  let msg = message.replace(/\^A/g, '\x01').trim();
  const delim = delimiter === '\x01' ? '\x01' : delimiter;
  const fields = msg.split(delim).filter(f => f.trim());

  const parsed = {
    fields: [],
    raw: message,
    delimiter: delimiter,
    header: {},
    body: {},
    trailer: {},
    repeatingGroups: []
  };

  let currentGroup = null;
  let groupInstance = null;
  let groupInstanceFields = [];

  fields.forEach((field) => {
    const [tag, ...valueParts] = field.split('=');
    const value = valueParts.join('=');

    if (tag && value !== undefined) {
      const tagNum = tag.trim();
      const fieldDef = FIX_FIELDS[tagNum] || { name: `Tag${tagNum}`, description: 'Unknown field', category: 'unknown' };

      const fieldData = {
        tag: tagNum,
        name: fieldDef.name,
        value: value,
        description: fieldDef.description,
        category: fieldDef.category,
        editable: true
      };

      // Check if this is a repeating group header
      if (REPEATING_GROUPS[tagNum]) {
        if (currentGroup) {
          if (groupInstance) {
            currentGroup.instances.push({...groupInstance, fields: [...groupInstanceFields]});
          }
          parsed.repeatingGroups.push(currentGroup);
        }

        currentGroup = {
          tag: tagNum,
          count: parseInt(value, 10),
          name: REPEATING_GROUPS[tagNum].name,
          groupFields: REPEATING_GROUPS[tagNum].fields,
          instances: []
        };
        groupInstance = null;
        groupInstanceFields = [];
      } else if (currentGroup && currentGroup.groupFields.includes(parseInt(tagNum, 10))) {
        if (!groupInstance) {
          groupInstance = { index: currentGroup.instances.length };
          groupInstanceFields = [];
        }
        groupInstanceFields.push(fieldData);

        const firstField = currentGroup.groupFields[0];
        if (parseInt(tagNum, 10) === firstField && groupInstanceFields.length > 1) {
          currentGroup.instances.push({...groupInstance, fields: [...groupInstanceFields]});
          groupInstance = { index: currentGroup.instances.length };
          groupInstanceFields = [fieldData];
        }
      } else {
        if (currentGroup && groupInstance) {
          currentGroup.instances.push({...groupInstance, fields: [...groupInstanceFields]});
          parsed.repeatingGroups.push(currentGroup);
          currentGroup = null;
          groupInstance = null;
          groupInstanceFields = [];
        }
      }

      parsed.fields.push(fieldData);

      // Categorize fields
      if (['8', '9', '35', '49', '56', '34', '52', '50', '57', '142', '143'].includes(tagNum)) {
        parsed.header[tagNum] = value;
      } else if (tagNum === '10') {
        parsed.trailer[tagNum] = value;
      } else {
        parsed.body[tagNum] = value;
      }
    }
  });

  // Save any remaining group
  if (currentGroup) {
    if (groupInstance) {
      currentGroup.instances.push({...groupInstance, fields: [...groupInstanceFields]});
    }
    parsed.repeatingGroups.push(currentGroup);
  }

  return parsed;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateField(field) {
  const rule = VALIDATION_RULES[field.tag];
  if (!rule) return null;

  const value = field.value;

  switch (rule.type) {
    case 'number':
      if (!/^\d+$/.test(value)) {
        return { type: 'error', message: `${rule.name} must be a positive integer` };
      }
      break;

    case 'price':
      if (!/^\d+(\.\d+)?$/.test(value)) {
        return { type: 'error', message: `${rule.name} must be a valid price (e.g., 150.50)` };
      }
      break;

    case 'enum':
      if (!rule.values.includes(value)) {
        return { type: 'warning', message: `${rule.name} has unexpected value '${value}'` };
      }
      break;

    case 'timestamp':
      if (!/^\d{8}-\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(value)) {
        return { type: 'error', message: `${rule.name} must be in format YYYYMMDD-HH:MM:SS` };
      }
      break;

    case 'date':
      if (!/^\d{8}$/.test(value)) {
        return { type: 'error', message: `${rule.name} must be in format YYYYMMDD` };
      }
      break;

    case 'checksum':
      if (!/^\d{3}$/.test(value)) {
        return { type: 'error', message: 'Checksum must be 3 digits' };
      }
      break;
  }

  return null;
}

function validateChecksum(data) {
  const checksumStatus = elements.checksumStatus;
  checksumStatus.innerHTML = '';
  checksumStatus.className = 'checksum-status';

  const checksumField = data.fields.find(f => f.tag === '10');
  if (!checksumField) {
    checksumStatus.textContent = 'No checksum';
    checksumStatus.classList.add('missing');
    return;
  }

  const delim = data.delimiter === '\x01' ? '\x01' : data.delimiter;
  const fieldsBeforeChecksum = data.fields.filter(f => f.tag !== '10');
  const messageBeforeChecksum = fieldsBeforeChecksum.map(f => `${f.tag}=${f.value}`).join(delim) + delim + '10=';

  const calculatedChecksum = calculateChecksum(messageBeforeChecksum);
  const actualChecksum = checksumField.value;

  if (calculatedChecksum === actualChecksum) {
    checksumStatus.textContent = `✓ Checksum valid (${actualChecksum})`;
    checksumStatus.classList.add('valid');
  } else {
    checksumStatus.textContent = `✗ Checksum invalid (expected ${calculatedChecksum}, got ${actualChecksum})`;
    checksumStatus.classList.add('invalid');
  }
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function displayParsedMessage(data) {
  const parsedOutput = elements.parsedOutput;
  parsedOutput.innerHTML = '';

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'field-row header';
  headerRow.innerHTML = `
    <div>Tag</div>
    <div>Field Name</div>
    <div>Value</div>
    <div>Actions</div>
  `;
  parsedOutput.appendChild(headerRow);

  // Track which fields are part of repeating groups
  const groupFieldTags = new Set();
  data.repeatingGroups.forEach(group => {
    group.instances.forEach(instance => {
      instance.fields.forEach(field => groupFieldTags.add(field.tag));
    });
  });

  // Field rows
  let currentGroupIndex = 0;
  data.fields.forEach((field, index) => {
    // Check if we should insert a repeating group here
    if (currentGroupIndex < data.repeatingGroups.length) {
      const group = data.repeatingGroups[currentGroupIndex];
      if (field.tag === group.tag) {
        const groupContainer = createRepeatingGroupDisplay(group);
        parsedOutput.appendChild(groupContainer);
        currentGroupIndex++;
      }
    }

    // Skip fields that are inside repeating groups (already displayed)
    if (!groupFieldTags.has(field.tag) || REPEATING_GROUPS[field.tag]) {
      const row = createFieldRow(field, index);
      parsedOutput.appendChild(row);

      // Append validation row if exists
      if (row.validationRow) {
        parsedOutput.appendChild(row.validationRow);
      }
    }
  });
}

function createRepeatingGroupDisplay(group) {
  const container = document.createElement('div');
  container.className = 'repeating-group';

  const header = document.createElement('div');
  header.className = 'repeating-group-header';
  header.innerHTML = `
    <span>${group.name} (${group.count} instances)</span>
    <span style="font-size: 12px; color: var(--text-color-secondary, #6c757d);">Tag ${group.tag}</span>
  `;
  container.appendChild(header);

  group.instances.forEach((instance, idx) => {
    const instanceDiv = document.createElement('div');
    instanceDiv.className = 'repeating-group-instance';

    const instanceHeader = document.createElement('div');
    instanceHeader.className = 'repeating-group-instance-header';
    instanceHeader.textContent = `Instance ${idx + 1}`;
    instanceDiv.appendChild(instanceHeader);

    instance.fields.forEach(field => {
      const fieldDiv = document.createElement('div');
      fieldDiv.style.display = 'grid';
      fieldDiv.style.gridTemplateColumns = '80px 200px 1fr';
      fieldDiv.style.gap = '10px';
      fieldDiv.style.padding = '6px 0';
      fieldDiv.style.fontSize = '13px';

      const tagSpan = document.createElement('span');
      tagSpan.style.fontFamily = "'Courier New', monospace";
      tagSpan.style.color = '#007bff';
      tagSpan.style.fontWeight = '600';
      tagSpan.textContent = field.tag;

      const nameSpan = document.createElement('span');
      nameSpan.style.fontWeight = '500';
      nameSpan.textContent = field.name;

      const valueSpan = document.createElement('span');
      valueSpan.style.fontFamily = "'Courier New', monospace";
      valueSpan.textContent = field.value;

      fieldDiv.appendChild(tagSpan);
      fieldDiv.appendChild(nameSpan);
      fieldDiv.appendChild(valueSpan);

      instanceDiv.appendChild(fieldDiv);
    });

    container.appendChild(instanceDiv);
  });

  return container;
}

function createFieldRow(field, index) {
  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.index = index;
  row.dataset.tag = field.tag;
  row.dataset.name = field.name.toLowerCase();
  row.dataset.value = field.value.toLowerCase();

  const tagDiv = document.createElement('div');
  tagDiv.className = 'field-tag';
  tagDiv.textContent = field.tag;

  const nameDiv = document.createElement('div');
  nameDiv.className = 'field-name';
  nameDiv.textContent = field.name;

  const valueDiv = document.createElement('div');
  valueDiv.className = 'field-value';

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.value = field.value;
  valueInput.dataset.originalValue = field.value;
  valueInput.addEventListener('change', (e) => updateFieldValue(index, e.target.value));

  // Validate field
  const validation = validateField(field);
  if (validation) {
    if (validation.type === 'error') {
      valueInput.classList.add('invalid');
    } else if (validation.type === 'warning') {
      valueInput.classList.add('warning');
    }
    valueInput.title = validation.message;
  }

  valueDiv.appendChild(valueInput);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'field-actions';

  const infoBtn = document.createElement('button');
  infoBtn.className = 'icon-btn';
  infoBtn.textContent = 'ℹ️';
  infoBtn.title = 'Show description';
  infoBtn.addEventListener('click', () => toggleDescription(row, field));

  const copyBtn = document.createElement('button');
  copyBtn.className = 'icon-btn';
  copyBtn.textContent = '📋';
  copyBtn.title = 'Copy value';
  copyBtn.addEventListener('click', () => copyToClipboard(field.value));

  actionsDiv.appendChild(infoBtn);
  actionsDiv.appendChild(copyBtn);

  row.appendChild(tagDiv);
  row.appendChild(nameDiv);
  row.appendChild(valueDiv);
  row.appendChild(actionsDiv);

  // Add validation message row if needed
  if (validation) {
    const validationRow = document.createElement('div');
    validationRow.className = 'field-row';
    const validationDiv = document.createElement('div');
    validationDiv.className = validation.type === 'error' ? 'validation-error' : 'validation-warning';
    validationDiv.textContent = validation.message;
    validationRow.appendChild(validationDiv);

    row.dataset.hasValidation = 'true';
    row.validationRow = validationRow;
  }

  return row;
}

function toggleDescription(row, field) {
  const existing = row.nextElementSibling;
  if (existing && existing.classList.contains('field-description')) {
    existing.remove();
    return;
  }

  const descRow = document.createElement('div');
  descRow.className = 'field-row';
  const descDiv = document.createElement('div');
  descDiv.className = 'field-description';
  descDiv.textContent = field.description;
  if (field.category) {
    descDiv.textContent += ` (Category: ${field.category})`;
  }
  descRow.appendChild(descDiv);

  row.parentNode.insertBefore(descRow, row.nextSibling);
}

function displayRawMessage(data) {
  const delim = data.delimiter === '\x01' ? '|' : data.delimiter;
  const fields = data.fields.map(f => `${f.tag}=${f.value}`);
  elements.rawOutput.value = fields.join(delim);
}

function displayJSONMessage(data) {
  const json = {
    header: {},
    body: {},
    trailer: {},
    repeatingGroups: []
  };

  data.fields.forEach(field => {
    const obj = {
      tag: field.tag,
      name: field.name,
      value: field.value,
      description: field.description,
      category: field.category
    };

    if (['8', '9', '35', '49', '56', '34', '52', '50', '57', '142', '143'].includes(field.tag)) {
      json.header[field.tag] = obj;
    } else if (field.tag === '10') {
      json.trailer[field.tag] = obj;
    } else {
      json.body[field.tag] = obj;
    }
  });

  if (data.repeatingGroups && data.repeatingGroups.length > 0) {
    json.repeatingGroups = data.repeatingGroups;
  }

  elements.jsonOutput.textContent = JSON.stringify(json, null, 2);
}

function updateMessageInfo(data) {
  const messageInfo = elements.messageInfo;
  messageInfo.innerHTML = '';

  const version = data.header['8'];
  if (version) {
    const badge = document.createElement('span');
    badge.className = 'info-badge version';
    badge.textContent = version;
    messageInfo.appendChild(badge);
  }

  const msgType = data.header['35'];
  if (msgType) {
    const badge = document.createElement('span');
    badge.className = 'info-badge type';
    badge.textContent = MSG_TYPES[msgType] || `Type ${msgType}`;
    messageInfo.appendChild(badge);
  }

  const fieldCount = document.createElement('span');
  fieldCount.className = 'info-badge';
  fieldCount.textContent = `${data.fields.length} fields`;
  messageInfo.appendChild(fieldCount);

  if (data.repeatingGroups && data.repeatingGroups.length > 0) {
    const groupCount = document.createElement('span');
    groupCount.className = 'info-badge';
    groupCount.textContent = `${data.repeatingGroups.length} groups`;
    messageInfo.appendChild(groupCount);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function parseMessage() {
  const input = elements.fixInput.value.trim();
  if (!input) {
    showError('Please enter a FIX message');
    return;
  }

  const delimiter = getDelimiter(input, elements.delimiterSelect.value);

  // Check if it's multiple messages (session log)
  const lines = input.split('\n').filter(line => line.trim() && line.includes('8=FIX'));
  if (lines.length > 1) {
    showInfo('Multiple messages detected. Switch to Session Log tab to parse.');
    parseSessionLog();
    switchTab('session');
    return;
  }

  try {
    parsedData = parseFIXMessage(input, delimiter);
    displayParsedMessage(parsedData);
    displayRawMessage(parsedData);
    displayJSONMessage(parsedData);
    updateMessageInfo(parsedData);
    validateChecksum(parsedData);
  } catch (error) {
    showError(`Parse error: ${error.message}`);
  }
}

function updateFieldValue(index, newValue) {
  if (parsedData && parsedData.fields[index]) {
    parsedData.fields[index].value = newValue;

    const tag = parsedData.fields[index].tag;
    if (['8', '9', '35', '49', '56', '34', '52', '50', '57', '142', '143'].includes(tag)) {
      parsedData.header[tag] = newValue;
    } else if (tag === '10') {
      parsedData.trailer[tag] = newValue;
    } else {
      parsedData.body[tag] = newValue;
    }

    displayParsedMessage(parsedData);
    displayRawMessage(parsedData);
    displayJSONMessage(parsedData);
    validateChecksum(parsedData);
  }
}

function recalculateChecksum() {
  if (!parsedData) return;

  const delim = parsedData.delimiter === '\x01' ? '\x01' : parsedData.delimiter;
  const fieldsBeforeChecksum = parsedData.fields.filter(f => f.tag !== '10');
  const messageBeforeChecksum = fieldsBeforeChecksum.map(f => `${f.tag}=${f.value}`).join(delim) + delim + '10=';

  const calculatedChecksum = calculateChecksum(messageBeforeChecksum);

  const checksumField = parsedData.fields.find(f => f.tag === '10');
  if (checksumField) {
    checksumField.value = calculatedChecksum;
    parsedData.trailer['10'] = calculatedChecksum;
    displayParsedMessage(parsedData);
    displayRawMessage(parsedData);
    displayJSONMessage(parsedData);
    validateChecksum(parsedData);
    showSuccess('Checksum recalculated successfully');
  }
}

function recalculateBodyLength() {
  if (!parsedData) return;

  const delim = parsedData.delimiter === '\x01' ? '\x01' : parsedData.delimiter;
  const bodyFields = parsedData.fields.filter(f => f.tag !== '8' && f.tag !== '9' && f.tag !== '10');
  const bodyString = bodyFields.map(f => `${f.tag}=${f.value}`).join(delim);
  const bodyLength = bodyString.length + (delim === '\x01' ? 1 : delim.length);

  const bodyLengthField = parsedData.fields.find(f => f.tag === '9');
  if (bodyLengthField) {
    bodyLengthField.value = bodyLength.toString();
    parsedData.header['9'] = bodyLength.toString();
    displayParsedMessage(parsedData);
    displayRawMessage(parsedData);
    displayJSONMessage(parsedData);
    showSuccess('BodyLength recalculated successfully');
  }
}

function loadSample(sampleKey) {
  if (!sampleKey) return;

  const message = SAMPLE_MESSAGES[sampleKey];
  if (message) {
    elements.fixInput.value = message;
    if (sampleKey === 'session-log') {
      parseSessionLog();
      switchTab('session');
    } else {
      parseMessage();
    }
    elements.sampleSelect.value = '';
  }
}

function filterFields(query) {
  if (!parsedData) return;

  const lowerQuery = query.toLowerCase();
  const rows = elements.parsedOutput.querySelectorAll('.field-row:not(.header)');

  rows.forEach(row => {
    if (row.classList.contains('field-description')) {
      row.style.display = 'none';
      return;
    }

    const tag = row.dataset.tag || '';
    const name = row.dataset.name || '';
    const value = row.dataset.value || '';

    const matches = tag.includes(lowerQuery) ||
                   name.includes(lowerQuery) ||
                   value.includes(lowerQuery);

    row.style.display = matches ? 'grid' : 'none';
  });
}

function formatRawMessage() {
  if (!parsedData) return;

  const delim = parsedData.delimiter === '\x01' ? '|' : parsedData.delimiter;
  const fields = parsedData.fields.map(f => {
    const fieldDef = FIX_FIELDS[f.tag] || { name: `Tag${f.tag}` };
    return `${f.tag}=${f.value}  ${delim} ${fieldDef.name}`;
  });

  elements.rawOutput.value = fields.join('\n');
}

function compactRawMessage() {
  if (!parsedData) return;
  displayRawMessage(parsedData);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

function clearAll() {
  elements.fixInput.value = '';
  elements.parsedOutput.innerHTML = '';
  elements.rawOutput.value = '';
  elements.jsonOutput.textContent = '';
  elements.messageInfo.innerHTML = '';
  elements.checksumStatus.innerHTML = '';
  elements.checksumStatus.className = 'checksum-status';
  elements.fieldSearch.value = '';
  elements.sampleSelect.value = '';
  parsedData = null;
  sessionMessages = [];

  if (elements.sessionLogContainer) {
    elements.sessionLogContainer.innerHTML = '';
  }
  if (elements.sessionStats) {
    elements.sessionStats.textContent = '';
  }
  if (elements.builderTemplate) {
    elements.builderTemplate.value = '';
  }
  if (elements.builderFieldsContainer) {
    elements.builderFieldsContainer.innerHTML = '';
  }

  document.querySelectorAll('.error-message, .warning-message, .success-message').forEach(msg => msg.remove());
}

// ============================================================================
// SESSION LOG FUNCTIONS
// ============================================================================

function parseSessionLog() {
  const input = elements.fixInput.value.trim();
  if (!input) {
    showError('Please enter FIX session log');
    return;
  }

  const delimiter = getDelimiter(input, elements.delimiterSelect.value);
  const lines = input.split('\n').map(line => line.trim()).filter(line => line && line.includes('8=FIX'));

  if (lines.length === 0) {
    showError('No FIX messages found in session log');
    return;
  }

  sessionMessages = [];
  lines.forEach((line, idx) => {
    try {
      const parsed = parseFIXMessage(line, delimiter);
      sessionMessages.push({
        index: idx + 1,
        raw: line,
        parsed: parsed,
        timestamp: parsed.header['52'] || 'N/A',
        msgType: parsed.header['35'] || 'Unknown',
        msgTypeName: MSG_TYPES[parsed.header['35']] || 'Unknown',
        sender: parsed.header['49'] || 'N/A',
        target: parsed.header['56'] || 'N/A',
        seqNum: parsed.header['34'] || 'N/A'
      });
    } catch (error) {
      console.error(`Error parsing message ${idx + 1}:`, error);
    }
  });

  displaySessionLog();
  showSuccess(`Parsed ${sessionMessages.length} messages from session log`);
}

function displaySessionLog() {
  const container = elements.sessionLogContainer;
  container.innerHTML = '';

  if (elements.sessionStats) {
    elements.sessionStats.textContent = `${sessionMessages.length} messages`;
  }

  sessionMessages.forEach((msg, idx) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'session-message';
    msgDiv.dataset.index = idx;

    const header = document.createElement('div');
    header.className = 'session-message-header';

    const typeSpan = document.createElement('span');
    typeSpan.className = 'session-message-type';
    typeSpan.textContent = `#${msg.index}: ${msg.msgTypeName} (${msg.msgType})`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'session-message-time';
    timeSpan.textContent = `${msg.timestamp} | Seq: ${msg.seqNum}`;

    header.appendChild(typeSpan);
    header.appendChild(timeSpan);

    const preview = document.createElement('div');
    preview.className = 'session-message-preview';
    preview.textContent = `${msg.sender} → ${msg.target}`;

    msgDiv.appendChild(header);
    msgDiv.appendChild(preview);

    msgDiv.addEventListener('click', () => {
      container.querySelectorAll('.session-message').forEach(m => m.classList.remove('selected'));
      msgDiv.classList.add('selected');

      parsedData = msg.parsed;
      displayParsedMessage(parsedData);
      displayRawMessage(parsedData);
      displayJSONMessage(parsedData);
      updateMessageInfo(parsedData);
      validateChecksum(parsedData);

      switchTab('parsed');
    });

    container.appendChild(msgDiv);
  });
}

function exportSession() {
  if (sessionMessages.length === 0) {
    showError('No session messages to export');
    return;
  }

  const csv = generateSessionCSV();
  downloadFile('fix-session-log.csv', csv, 'text/csv');
  showSuccess('Session log exported as CSV');
}

function generateSessionCSV() {
  const headers = ['Index', 'Timestamp', 'MsgType', 'Sender', 'Target', 'SeqNum', 'FieldCount', 'Raw'];
  const rows = sessionMessages.map(msg => [
    msg.index,
    msg.timestamp,
    `${msg.msgTypeName} (${msg.msgType})`,
    msg.sender,
    msg.target,
    msg.seqNum,
    msg.parsed.fields.length,
    `"${msg.raw.replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// ============================================================================
// MESSAGE BUILDER FUNCTIONS
// ============================================================================

function getCurrentFIXTimestamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}:${minutes}:${seconds}`;
}

function loadBuilderTemplate(templateKey) {
  if (!templateKey) {
    elements.builderFieldsContainer.innerHTML = '';
    return;
  }

  const message = SAMPLE_MESSAGES[templateKey];
  if (message) {
    const parsed = parseFIXMessage(message, '|');

    elements.builderVersion.value = parsed.header['8'] || 'FIX.4.2';
    elements.builderMsgtype.value = parsed.header['35'] || 'D';
    elements.builderSender.value = parsed.header['49'] || 'SENDER';
    elements.builderTarget.value = parsed.header['56'] || 'TARGET';
    elements.builderSeqnum.value = parsed.header['34'] || '1';

    updateBuilderFields();
    showSuccess('Template loaded successfully');
  }
}

function updateBuilderFields() {
  const msgType = elements.builderMsgtype.value;
  const container = elements.builderFieldsContainer;
  container.innerHTML = '';

  const commonFields = [
    { tag: 11, name: 'ClOrdID', required: ['D', 'F', 'G'].includes(msgType) },
    { tag: 55, name: 'Symbol', required: ['D', 'F', 'G', 'V'].includes(msgType) },
    { tag: 54, name: 'Side', required: ['D', 'F', 'G'].includes(msgType), type: 'select', options: [
      { value: '1', label: '1 - Buy' },
      { value: '2', label: '2 - Sell' }
    ]},
    { tag: 38, name: 'OrderQty', required: ['D', 'G'].includes(msgType) },
    { tag: 40, name: 'OrdType', required: ['D', 'G'].includes(msgType), type: 'select', options: [
      { value: '1', label: '1 - Market' },
      { value: '2', label: '2 - Limit' },
      { value: '3', label: '3 - Stop' },
      { value: '4', label: '4 - Stop Limit' }
    ]},
    { tag: 44, name: 'Price', required: false },
    { tag: 59, name: 'TimeInForce', required: false, type: 'select', options: [
      { value: '0', label: '0 - Day' },
      { value: '1', label: '1 - GTC' },
      { value: '3', label: '3 - IOC' },
      { value: '4', label: '4 - FOK' }
    ]},
    { tag: 41, name: 'OrigClOrdID', required: ['F', 'G'].includes(msgType) },
    { tag: 108, name: 'HeartBtInt', required: msgType === 'A' },
    { tag: 98, name: 'EncryptMethod', required: msgType === 'A', type: 'select', options: [
      { value: '0', label: '0 - None' }
    ]},
    { tag: 112, name: 'TestReqID', required: msgType === '1' },
    { tag: 58, name: 'Text', required: false },
  ];

  commonFields.forEach(fieldConfig => {
    if (fieldConfig.required || msgType === 'D') {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';

      const label = document.createElement('label');
      label.textContent = `${fieldConfig.name} (Tag ${fieldConfig.tag})${fieldConfig.required ? ' *' : ''}`;
      formGroup.appendChild(label);

      let input;
      if (fieldConfig.type === 'select' && fieldConfig.options) {
        input = document.createElement('select');
        fieldConfig.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = 'text';
      }

      input.id = `builder-field-${fieldConfig.tag}`;
      input.dataset.tag = fieldConfig.tag;
      formGroup.appendChild(input);

      const fieldDef = FIX_FIELDS[fieldConfig.tag];
      if (fieldDef && fieldDef.description) {
        const small = document.createElement('small');
        small.textContent = fieldDef.description;
        formGroup.appendChild(small);
      }

      container.appendChild(formGroup);
    }
  });
}

function generateMessage() {
  const version = elements.builderVersion.value;
  const msgType = elements.builderMsgtype.value;
  const sender = elements.builderSender.value;
  const target = elements.builderTarget.value;
  const seqNum = elements.builderSeqnum.value;

  if (!sender || !target || !seqNum) {
    showError('Please fill in required header fields');
    return;
  }

  const fields = [
    { tag: '8', value: version },
    { tag: '9', value: '0' },
    { tag: '35', value: msgType },
    { tag: '49', value: sender },
    { tag: '56', value: target },
    { tag: '34', value: seqNum },
    { tag: '52', value: getCurrentFIXTimestamp() }
  ];

  const customFields = elements.builderFieldsContainer.querySelectorAll('input, select');
  customFields.forEach(input => {
    const tag = input.dataset.tag;
    const value = input.value.trim();
    if (value) {
      fields.push({ tag, value });
    }
  });

  const delim = '|';
  let messageFields = fields.filter(f => f.tag !== '8' && f.tag !== '9' && f.tag !== '10');
  const bodyString = messageFields.map(f => `${f.tag}=${f.value}`).join(delim);
  const bodyLength = bodyString.length + delim.length;

  fields.find(f => f.tag === '9').value = bodyLength.toString();

  const messageBeforeChecksum = fields.map(f => `${f.tag}=${f.value}`).join(delim) + delim + '10=';
  const checksum = calculateChecksum(messageBeforeChecksum);

  fields.push({ tag: '10', value: checksum });

  const message = fields.map(f => `${f.tag}=${f.value}`).join(delim);

  elements.fixInput.value = message;
  parseMessage();
  switchTab('parsed');
  showSuccess('Message generated successfully');
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function exportCSV() {
  if (!parsedData) {
    showError('No message to export');
    return;
  }

  const headers = ['Tag', 'Field Name', 'Value', 'Category', 'Description'];
  const rows = parsedData.fields.map(field => [
    field.tag,
    field.name,
    `"${field.value.replace(/"/g, '""')}"`,
    field.category || '',
    `"${field.description.replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  downloadFile('fix-message.csv', csv, 'text/csv');
  showSuccess('Exported as CSV');
}

function exportXML() {
  if (!parsedData) {
    showError('No message to export');
    return;
  }

  const msgType = parsedData.header['35'];
  const msgTypeName = MSG_TYPES[msgType] || 'Message';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<FIXML xmlns="http://www.fixprotocol.org/FIXML-5-0">\n`;
  xml += `  <${msgTypeName.replace(/\s/g, '')} MsgType="${msgType}">\n`;

  parsedData.fields.forEach(field => {
    if (field.tag !== '8' && field.tag !== '9' && field.tag !== '10') {
      xml += `    <${field.name} Tag="${field.tag}">${escapeXML(field.value)}</${field.name}>\n`;
    }
  });

  xml += `  </${msgTypeName.replace(/\s/g, '')}>\n`;
  xml += '</FIXML>';

  downloadFile('fix-message.xml', xml, 'application/xml');
  showSuccess('Exported as FIXML');
}

function exportHTML() {
  if (!parsedData) {
    showError('No message to export');
    return;
  }

  const msgType = parsedData.header['35'];
  const msgTypeName = MSG_TYPES[msgType] || 'Unknown';
  const version = parsedData.header['8'];
  const timestamp = new Date().toISOString();

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FIX Message Report - ${msgTypeName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #007bff; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
    .meta { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .meta-item { display: inline-block; margin-right: 30px; }
    .meta-label { font-weight: 600; color: #6c757d; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #007bff; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #dee2e6; }
    tr:hover { background: #f8f9fa; }
    .tag { font-family: 'Courier New', monospace; color: #007bff; font-weight: 600; }
    .value { font-family: 'Courier New', monospace; }
    .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>FIX Message Report</h1>
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Message Type:</span> ${msgTypeName} (${msgType})</div>
      <div class="meta-item"><span class="meta-label">FIX Version:</span> ${version}</div>
      <div class="meta-item"><span class="meta-label">Fields:</span> ${parsedData.fields.length}</div>
      <div class="meta-item"><span class="meta-label">Generated:</span> ${timestamp}</div>
    </div>
    <h2>Message Fields</h2>
    <table>
      <thead>
        <tr>
          <th>Tag</th>
          <th>Field Name</th>
          <th>Value</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>`;

  parsedData.fields.forEach(field => {
    html += `
        <tr>
          <td class="tag">${field.tag}</td>
          <td>${field.name}</td>
          <td class="value">${escapeHTML(field.value)}</td>
          <td>${escapeHTML(field.description)}</td>
        </tr>`;
  });

  html += `
      </tbody>
    </table>
    <div class="footer">
      Generated by DevChef FIX Parser on ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;

  downloadFile('fix-message-report.html', html, 'text/html');
  showSuccess('Exported as HTML Report');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeXML(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => btn.textContent = originalText, 2000);
  }).catch(() => {
    showError('Failed to copy to clipboard');
  });
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showError(message) {
  showMessage(message, 'error');
}

function showWarning(message) {
  showMessage(message, 'warning');
}

function showSuccess(message) {
  showMessage(message, 'success');
}

function showInfo(message) {
  showMessage(message, 'success');
}

function showMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `${type}-message`;
  messageDiv.textContent = message;

  const container = document.querySelector('.fix-parser-container');
  if (!container) return;

  const inputSection = container.querySelector('.input-section');
  const existing = inputSection.querySelector(`.${type}-message`);
  if (existing) existing.remove();

  inputSection.appendChild(messageDiv);
  setTimeout(() => messageDiv.remove(), 5000);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init(context) {
  const container = context.container;

  // Initialize element references
  elements = {
    fixInput: container.querySelector('#fix-input'),
    parseBtn: container.querySelector('#parse-btn'),
    clearBtn: container.querySelector('#clear-btn'),
    sampleSelect: container.querySelector('#sample-select'),
    delimiterSelect: container.querySelector('#delimiter-select'),
    fieldSearch: container.querySelector('#field-search'),
    recalcChecksumBtn: container.querySelector('#recalc-checksum-btn'),
    recalcBodylengthBtn: container.querySelector('#recalc-bodylength-btn'),
    checksumStatus: container.querySelector('#checksum-status'),
    parsedOutput: container.querySelector('#parsed-output'),
    rawOutput: container.querySelector('#raw-output'),
    jsonOutput: container.querySelector('#json-output'),
    messageInfo: container.querySelector('#message-info'),
    copyRawBtn: container.querySelector('#copy-raw-btn'),
    formatRawBtn: container.querySelector('#format-raw-btn'),
    compactRawBtn: container.querySelector('#compact-raw-btn'),
    copyJsonBtn: container.querySelector('#copy-json-btn'),
    downloadJsonBtn: container.querySelector('#download-json-btn'),
    exportCsvBtn: container.querySelector('#export-csv-btn'),
    exportXmlBtn: container.querySelector('#export-xml-btn'),
    exportHtmlBtn: container.querySelector('#export-html-btn'),
    builderTemplate: container.querySelector('#builder-template'),
    builderVersion: container.querySelector('#builder-version'),
    builderMsgtype: container.querySelector('#builder-msgtype'),
    builderSender: container.querySelector('#builder-sender'),
    builderTarget: container.querySelector('#builder-target'),
    builderSeqnum: container.querySelector('#builder-seqnum'),
    builderFieldsContainer: container.querySelector('#builder-fields-container'),
    builderGenerateBtn: container.querySelector('#builder-generate-btn'),
    parseSessionBtn: container.querySelector('#parse-session-btn'),
    exportSessionBtn: container.querySelector('#export-session-btn'),
    sessionLogContainer: container.querySelector('#session-log-container'),
    sessionStats: container.querySelector('#session-stats')
  };

  // Set up event listeners
  elements.parseBtn.addEventListener('click', parseMessage);
  elements.clearBtn.addEventListener('click', clearAll);
  elements.sampleSelect.addEventListener('change', (e) => loadSample(e.target.value));
  elements.recalcChecksumBtn.addEventListener('click', recalculateChecksum);
  elements.recalcBodylengthBtn.addEventListener('click', recalculateBodyLength);
  elements.fieldSearch.addEventListener('input', (e) => filterFields(e.target.value));
  elements.copyRawBtn.addEventListener('click', () => copyToClipboard(elements.rawOutput.value));
  elements.formatRawBtn.addEventListener('click', formatRawMessage);
  elements.compactRawBtn.addEventListener('click', compactRawMessage);
  elements.copyJsonBtn.addEventListener('click', () => copyToClipboard(elements.jsonOutput.textContent));
  elements.downloadJsonBtn.addEventListener('click', () => downloadFile('fix-message.json', elements.jsonOutput.textContent, 'application/json'));
  elements.exportCsvBtn.addEventListener('click', exportCSV);
  elements.exportXmlBtn.addEventListener('click', exportXML);
  elements.exportHtmlBtn.addEventListener('click', exportHTML);
  elements.builderTemplate.addEventListener('change', (e) => loadBuilderTemplate(e.target.value));
  elements.builderMsgtype.addEventListener('change', updateBuilderFields);
  elements.builderGenerateBtn.addEventListener('click', generateMessage);
  elements.parseSessionBtn.addEventListener('click', parseSessionLog);
  elements.exportSessionBtn.addEventListener('click', exportSession);

  // Tab switching
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Keyboard shortcuts
  elements.fixInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      parseMessage();
    }
  });

  // Initialize builder
  updateBuilderFields();
}

export function cleanup(context) {
  // Cleanup if needed
  parsedData = null;
  sessionMessages = [];
  elements = {};
}
