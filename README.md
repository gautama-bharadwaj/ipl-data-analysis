# ipl-data-analysis

This repository contains the Indian Premier League (IPL) dataset obtained from [Cricsheet](https://cricsheet.org/). The raw IPL dataset is stored in the `dataset/ipl_json` folder.

## Dataset

The IPL dataset consists of JSON files containing match data. These files are located in the `dataset/ipl_json` directory.

## Scripts

### JSON to CSV Conversion

The `json_to_csv.py` script located in the `scripts` directory converts the raw JSON data from cricsheet into CSV format. It extracts relevant information from each JSON file and creates a CSV file for each match. These CSV files are stored in the `dataset/csv` directory.

## Usage

To convert the raw JSON data into CSV format, run the `json_to_csv.py` script. Ensure that the IPL dataset JSON files are located in the `dataset/ipl_json` directory. After running the script, the CSV files will be generated in the `dataset/csv` directory.

## Acknowledgements

- [Cricsheet](https://cricsheet.org/): The source of the IPL dataset.

