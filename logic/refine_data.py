import json
import os

def refine_data():
    input_path = 'data/catalog_products.json'
    output_path = 'data/refined_catalog.json'

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        products = json.load(f)

    # Filter only display=true items if needed, but the plan said "100 items (Display Y)"
    # The sample data showed 'display': true.
    
    display_products = [p for p in products if p.get('display') is True]
    
    # Take top 100
    selected_products = display_products[:100]
    
    # Modify top 20 to have 'is_table_view': True
    final_products = []
    for i, product in enumerate(selected_products):
        new_product = product.copy()
        if i < 20:
            new_product['is_table_view'] = True
        else:
            new_product['is_table_view'] = False
        final_products.append(new_product)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_products, f, indent=4, ensure_ascii=False)
    
    print(f"Created {output_path} with {len(final_products)} items.")
    print(f"Top {len([p for p in final_products if p['is_table_view']])} marked for table view.")

if __name__ == "__main__":
    refine_data()
