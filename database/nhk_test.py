# -*- coding: utf-8 -*-

# Pitch Accent add-on for Anki 2.1
# Copyright (C) 2021  Ren Tatsumoto. <tatsu at autistici.org>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
# Any modifications to this file must keep this entire header intact.

import re
import subprocess

# from typing import NamedTuple
from dataclasses import dataclass

try:
    from .common import *
except ImportError:
    from common import *


@dataclass
class AccentEntrySimplified:
    NID: str
    ID: str
    katakana_reading: str
    katakana_reading_alt: str
    kanjiexpr: str
    devoiced_pos: str
    nasalsoundpos: str
    accent: str


@dataclass
# class AccentEntry(NamedTuple):
class AccentEntry:
    NID: str
    ID: str
    WAVname: str
    K_FLD: str
    ACT: str
    katakana_reading: str
    nhk: str
    kanjiexpr: str
    NHKexpr: str
    numberchars: str
    devoiced_pos: str
    nasalsoundpos: str
    majiri: str
    kaisi: str
    KWAV: str
    katakana_reading_alt: str
    akusentosuu: str
    bunshou: str
    accent: str

    def simplify(self):
        return AccentEntrySimplified(
            self.NID,
            self.ID,
            self.katakana_reading,
            self.katakana_reading_alt,
            self.kanjiexpr,
            self.devoiced_pos,
            self.nasalsoundpos,
            self.accent,
        )


def make_accent_entry(csv_line: str) -> AccentEntry:
    csv_line = csv_line.strip()
    # Special entries in the CSV file that have to be escaped
    # to prevent them from being treated as multiple fields.
    sub_entries = re.findall(r"({.*?,.*?})", csv_line) + re.findall(
        r"(\(.*?,.*?\))", csv_line
    )
    for s in sub_entries:
        csv_line = csv_line.replace(s, s.replace(",", ";"))

    return AccentEntry(*csv_line.split(","))


def format_nasal_or_devoiced_positions(expr: str):
    # Sometimes the expr ends with 10
    if expr.endswith("10"):
        expr = expr[:-2]
        result = [10]
    else:
        result = []

    return result + [int(pos) for pos in expr.split("0") if pos]


def format_entry(e: AccentEntry) -> str:
    """Format an entry from the data in the original database to something that uses html"""
    kana_reading, acc_pattern = e.katakana_reading_alt, e.accent

    # Fix accent notation by prepending zeros for moraes where accent info is omitted in the CSV.
    acc_pattern = "0" * (len(kana_reading) - len(acc_pattern)) + acc_pattern

    # Get the nasal positions
    nasal = format_nasal_or_devoiced_positions(e.nasalsoundpos)

    # Get the devoiced positions
    devoiced = format_nasal_or_devoiced_positions(e.devoiced_pos)

    result_str = []
    overline_flag = False

    for idx, acc in enumerate(int(pos) for pos in acc_pattern):
        # Start or end overline when necessary
        if not overline_flag and acc > 0:
            result_str += '<span class="overline">'
            overline_flag = True
        if overline_flag and acc == 0:
            result_str += "</span>"
            overline_flag = False

        # Wrap character if it's devoiced, else add as is.
        if (idx + 1) in devoiced:
            result_str += f'<span class="nopron">{kana_reading[idx]}</span>'
        else:
            result_str += kana_reading[idx]

        if (idx + 1) in nasal:
            result_str += '<span class="nasal">&#176;</span>'

        # If we go down in pitch, add the downfall
        if acc == 2:
            result_str += "</span>&#42780;"
            overline_flag = False

    # Close the overline if it's still open
    if overline_flag:
        result_str += "</span>"

    return "".join(result_str)


def get_moras(reading: str):
    ignored_kana = "ょゅゃョュャ"
    assert len(reading) != 0
    l = len(reading)

    moras = []
    current_pos = 0
    while current_pos < l:
        if current_pos != (l - 1) and reading[current_pos + 1] in ignored_kana:
            moras.append(reading[current_pos : current_pos + 2])
            current_pos += 1
        else:
            moras.append(reading[current_pos])
        current_pos += 1

    return moras


def normalize_devoiced_or_nasal(x, moras, e):
    if not x: # if x is empty
        return []

    formatted = sorted(format_nasal_or_devoiced_positions(x))
    result = []

    #count = 0
    #i = 0
    #for j, mora in enumerate(moras):
    #    count += len(mora)
    #    if formatted[i] == count:
    #        result.append(j)
    #        i += 1

    #        if i >= len(formatted):
    #            break

    count = 0
    i = 0
    leave = False
    for j, mora in enumerate(moras):
        for k in mora:
            count += 1

            if formatted[i] == count:
                result.append(j)
                i += 1

                if i >= len(formatted):
                    leave = True
                    break
        if leave:
            break


    if e.kanjiexpr == "生活改良普及員":
        print(result, formatted, e.simplify())


    assert i == len(formatted), (formatted, moras, result, i, e.simplify())
    return result


class NhkDb(AccDbManager):
    accent_database = os.path.join(DB_DIR_PATH, "nhk_data.csv")
    derivative_database = os.path.join(DB_DIR_PATH, "nhk_pronunciation.csv")

    @classmethod
    def build_derivative(cls, dest_path: str = derivative_database) -> None:
        """Build the derived database from the original database and save it as *.csv"""
        temp_dict = {}

        count = 0
        with open(cls.accent_database, "r", encoding="utf-8") as f:
            for line in f:
                count += 1
                e = make_accent_entry(line)
                print(e)

                if count > 20:
                    raise Exception()
            entries: List[AccentEntry] = [make_accent_entry(line) for line in f]

        for entry in entries:
            # A tuple holding both the spelling in katakana, and the katakana with pitch/accent markup
            value = (entry.katakana_reading, format_entry(entry))

            # Add expressions for both
            for key in (entry.nhk, entry.kanjiexpr):
                temp_dict[key] = temp_dict.get(key, [])
                if value not in temp_dict[key]:
                    temp_dict[key].append(value)

        with open(dest_path, "w", encoding="utf-8") as of:
            for word in temp_dict.keys():
                for katakana, pitch_html in temp_dict[word]:
                    of.write(f"{word}\t{katakana}\t{pitch_html}\n")

    @classmethod
    def build_derivative2(cls, dest_path: str = derivative_database) -> None:
        """Build the derived database from the original database and save it as *.csv"""
        temp_dict = {}

        ignored = {
                "アイスコーヒー",
                }

        #count = 0
        with open(cls.accent_database, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                e = make_accent_entry(line)

                if e.kanjiexpr in ignored:
                    continue

                expected = normalize_devoiced_or_nasal(e.devoiced_pos, get_moras(e.katakana_reading), e)
                #y = os.system(f'node ./format.js <<< "{e.katakana_reading_alt}"')
                #y = subprocess.check_output(["./what.sh", e.katakana_reading_alt])
                simulated_bytes = subprocess.check_output(["node",  "./format.js", e.katakana_reading])
                #y = os.system(f'node ./format.js <<< "{e.katakana_reading_alt}"')

                simulated_str = simulated_bytes.decode("utf-8").strip()
                if not simulated_str:
                    simulated = []
                else:
                    simulated = [int(x) for x in simulated_str.split(",")]
                assert simulated == expected, (i, simulated, expected, e.simplify())
                #count += 1
                #if count > 20:
                #    return

                #if e.devoiced_pos and "ュ" in e.katakana_reading_alt:
                #    x = normalize_devoiced_or_nasal(e.devoiced_pos, get_moras(e.katakana_reading_alt))
                #    print(e.simplify(), x, format_nasal_or_devoiced_positions(e.devoiced_pos))
                #    count += 1
                #    if count > 20:
                #        return

                #if (
                #    "ュ" in e.katakana_reading_alt
                #    and format_nasal_or_devoiced_positions(e.devoiced_pos)
                #):
                #    print(e.simplify())
                #    count += 1
                #    if count > 20:
                #        return

                # print(e)

            # entries: List[AccentEntry] = [make_accent_entry(line) for line in f]

        # for entry in entries:
        #    # A tuple holding both the spelling in katakana, and the katakana with pitch/accent markup
        #    value = (entry.katakana_reading, format_entry(entry))

        #    # Add expressions for both
        #    for key in (entry.nhk, entry.kanjiexpr):
        #        temp_dict[key] = temp_dict.get(key, [])
        #        if value not in temp_dict[key]:
        #            temp_dict[key].append(value)

        # with open(dest_path, 'w', encoding="utf-8") as of:
        #    for word in temp_dict.keys():
        #        for katakana, pitch_html in temp_dict[word]:
        #            of.write(f"{word}\t{katakana}\t{pitch_html}\n")

    @classmethod
    def gamer(cls):
        if not os.path.isfile(cls.derivative_database):
            print("The derivative hasn't been built.")
        test_database = os.path.join(DB_DIR_PATH, "test.csv")
        cls.build_derivative2(dest_path=test_database)


if __name__ == "__main__":
    NhkDb.gamer()
