import csv
import io
import math
from collections.abc import Sequence

import numpy as np


class BatchCsvValidationError(ValueError):
    """Raised when an uploaded CSV cannot be safely used for batch scoring."""


def parse_transaction_csv(
    content: bytes,
    maximum_rows: int,
    feature_names: Sequence[str],
) -> np.ndarray:
    if not content:
        raise BatchCsvValidationError("The uploaded CSV file is empty.")

    try:
        decoded_content = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise BatchCsvValidationError("The CSV must use UTF-8 text encoding.") from error

    reader = csv.reader(io.StringIO(decoded_content, newline=""), strict=True)
    try:
        header = next(reader, None)
    except csv.Error as error:
        raise BatchCsvValidationError("The CSV header is malformed.") from error

    if not header or not any(column.strip() for column in header):
        raise BatchCsvValidationError("The CSV must contain a header row.")

    duplicate_features = [
        feature for feature in feature_names if header.count(feature) > 1
    ]
    if duplicate_features:
        names = ", ".join(duplicate_features)
        raise BatchCsvValidationError(f"Duplicate required column names: {names}.")

    missing_features = [feature for feature in feature_names if feature not in header]
    if missing_features:
        names = ", ".join(missing_features)
        raise BatchCsvValidationError(f"Missing required columns: {names}.")

    feature_positions = [header.index(feature) for feature in feature_names]
    feature_rows = []

    try:
        for row_number, row in enumerate(reader, start=1):
            if row_number > maximum_rows:
                raise BatchCsvValidationError(
                    f"The CSV exceeds the maximum of {maximum_rows:,} data rows."
                )
            if not row or not any(value.strip() for value in row):
                raise BatchCsvValidationError(
                    f"CSV data row {row_number} is empty. Remove blank rows and try again."
                )
            if len(row) != len(header):
                raise BatchCsvValidationError(
                    f"CSV data row {row_number} has {len(row)} values; expected {len(header)}."
                )

            values = []
            for feature_name, column_position in zip(feature_names, feature_positions):
                raw_value = row[column_position].strip()
                if not raw_value:
                    raise BatchCsvValidationError(
                        f"CSV data row {row_number} is missing a value for {feature_name}."
                    )
                try:
                    numeric_value = float(raw_value)
                except (ValueError, OverflowError) as error:
                    raise BatchCsvValidationError(
                        f"CSV data row {row_number} has a non-numeric value in {feature_name}."
                    ) from error
                if not math.isfinite(numeric_value):
                    raise BatchCsvValidationError(
                        f"CSV data row {row_number} has a non-finite value in {feature_name}."
                    )
                if feature_name == "Amount" and numeric_value < 0:
                    raise BatchCsvValidationError(
                        f"CSV data row {row_number} has a negative Amount."
                    )
                values.append(numeric_value)

            feature_rows.append(values)
    except csv.Error as error:
        raise BatchCsvValidationError("The CSV file is malformed.") from error

    if not feature_rows:
        raise BatchCsvValidationError("The CSV contains no transaction data rows.")

    return np.asarray(feature_rows, dtype=np.float64)