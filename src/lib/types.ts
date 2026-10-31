// 画面と API で共有する型。Apps Script（apps-script/Code.gs）が返す形に合わせている

export type Member = {
  name: string;
  /** "社員" または "バイト" */
  type: string;
  student: boolean;
};

export type Day = {
  day: number;
  /** "日"〜"土" */
  weekday: string;
  /** 祝日名。祝日でなければ空文字 */
  holiday: string;
};

export type ShiftRow = {
  name: string;
  /** "社員" / "バイト" / "バイト(学)" */
  type: string;
  /** 1日から順に、その日のセルの中身（"L" / "F" / "早" / "遅" / ""） */
  cells: string[];
};

/** "2026-11" の月のシート */
export type MonthData = {
  month: string;
  /** スプシにその月のシートがあるか */
  exists: boolean;
  published: boolean;
  days: Day[];
  rows: ShiftRow[];
};

/** /api/availability（GET）の返り値。本人の行だけ */
export type Availability = {
  /** 勤務可能日として出している日 */
  days: number[];
  /** 作成者がもうシフトを入れた日。{ 18: "L" } の形。この日はアプリで外せない */
  assigned: Record<number, string>;
};

/** /api/shift の返り値。公開前はシフトの中身（rows）を返さない */
export type ShiftResponse =
  | (MonthData & { published: true })
  | (Omit<MonthData, "rows"> & { published: false });

export type Shortage = {
  day: number;
  weekday: string;
  holiday: string;
  /** あと何人（0.5 刻み） */
  short: number;
  /** LINE 文面に使う「2枠」「遅番1枠」「1枠・遅番1枠」 */
  label: string;
};

/** /api/shortage の返り値。名前は含めない */
export type ShortageResponse = {
  month: string;
  exists: boolean;
  published: boolean;
  shortages: Shortage[];
};
