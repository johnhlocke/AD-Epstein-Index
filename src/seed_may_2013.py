"""
Seed the database with data extracted from AD May 2013 (proof of concept).
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(url, key)

# Step 1: Insert the issue
issue = supabase.table("issues").insert({
    "month": 5,
    "year": 2013,
    "cover_description": "The Good Life: Dazzling Homes Around the World"
}).execute()

issue_id = issue.data[0]["id"]
print(f"Created issue with id: {issue_id}")

# Step 2: Insert all featured homes
features = [
    {
        "issue_id": issue_id,
        "article_title": "High Spirits",
        "homeowner_name": "Michele Pitcher",
        "designer_name": "Marshall Watson Interiors",
        "architecture_firm": "Stephen Morgan Architect",
        "square_footage": 6800,
        "location_city": "San José del Cabo",
        "location_country": "Mexico",
        "design_style": "Palladian-inspired",
        "page_number": 116,
    },
    {
        "issue_id": issue_id,
        "article_title": "Playing Favorites",
        "homeowner_name": "Laurence & Patrick Seguin",
        "location_city": "Paris",
        "location_country": "France",
        "design_style": "Midcentury Modern",
        "page_number": 126,
    },
    {
        "issue_id": issue_id,
        "article_title": "Masterpiece Theater",
        "homeowner_name": "Gritti Palace (hotel)",
        "designer_name": "Donghia Associates",
        "location_city": "Venice",
        "location_country": "Italy",
        "design_style": "Historic palazzo",
        "page_number": 134,
        "notes": "Hotel renovation, not a private residence",
    },
    {
        "issue_id": issue_id,
        "article_title": "Singular Voice",
        "homeowner_name": "Anonymous",
        "designer_name": "Rafael de Cardenas Ltd. / Architecture at Large",
        "year_built": 1904,
        "location_city": "London",
        "location_country": "United Kingdom",
        "design_style": "Arts and Crafts / contemporary interior",
        "page_number": 146,
        "notes": "Homeowner described as 'a philanthropic young heiress' — name not published",
    },
    {
        "issue_id": issue_id,
        "article_title": "His Own Way",
        "homeowner_name": "Peter Rogers",
        "location_city": "New Orleans",
        "location_state": "Louisiana",
        "location_country": "United States",
        "design_style": "Creole cottage",
        "page_number": 154,
    },
    {
        "issue_id": issue_id,
        "article_title": "Island Hopping",
        "homeowner_name": "Jane & Max Gottschalk",
        "designer_name": "Carden Cunietti Ltd.",
        "location_city": "Ibiza",
        "location_country": "Spain",
        "design_style": "Mediterranean",
        "page_number": 162,
    },
    {
        "issue_id": issue_id,
        "article_title": "The Simple Life",
        "homeowner_name": "Virginie Deniot & Julien Dessouches",
        "designer_name": "Jean-Louis Deniot",
        "location_city": "Loire Valley",
        "location_country": "France",
        "design_style": "18th-century farmhouse",
        "page_number": 170,
    },
    {
        "issue_id": issue_id,
        "article_title": "Bright Spot",
        "homeowner_name": "Donata Meirelles",
        "designer_name": "Sig Bergamin Arquitetura",
        "location_city": "São Paulo",
        "location_country": "Brazil",
        "design_style": "Historic / tropical",
        "page_number": 176,
    },
]

result = supabase.table("features").insert(features).execute()
print(f"Inserted {len(result.data)} features")

# Step 3: Verify by reading back
count = supabase.table("features").select("*", count="exact").eq("issue_id", issue_id).execute()
print(f"Verified: {count.count} features in database for May 2013")
