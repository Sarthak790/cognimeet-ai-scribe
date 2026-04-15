from playwright.sync_api import sync_playwright
import google.generativeai as genai
from dotenv import load_dotenv
import time
import os
import boto3
import uuid

load_dotenv()

def join_meeting(meet_url: str):
    with sync_playwright() as p:
        profile_path = os.path.join(os.getcwd(), "bot_profile")
        
        context = p.chromium.launch_persistent_context(
            user_data_dir=profile_path,
            headless=False, 
            viewport={"width": 1280, "height": 720}, # 👈 Standard HD Viewport
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1280,720', # 👈 Forces the OS window to match perfectly
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--disable-audio-output',
                '--disable-blink-features=AutomationControlled'
            ],
            permissions=['microphone', 'camera']
        )
        
        page = context.pages[0] 

        print(f"Navigating to {meet_url}...")
        page.goto(meet_url)
        time.sleep(4)

        if "workspace.google.com/products/meet" in page.url or "You can't join this video call" in page.content():
            print("\n--- 🛑 GOOGLE BLOCKED US ---")
            page.goto("https://accounts.google.com/")
            time.sleep(120) 
            try: context.close() 
            except: pass
            return

        print("Muting Microphone and Camera...")
        page.keyboard.press("Control+d") 
        time.sleep(1)
        page.keyboard.press("Control+e") 
        time.sleep(1)

        print("Looking for Join button...")
        try:
            name_input = page.get_by_placeholder("Your name")
            if not name_input.is_visible():
                name_input = page.locator('input[aria-label="Your name"]')
            if name_input.is_visible():
                name_input.fill("Summary Bot")
        except Exception:
            pass 
        print("Checking if Google Meet requires a name...")
        try:
            # Wait up to 5 seconds to see if the "What's your name?" box appears
            name_input = page.locator('input[type="text"]')
            name_input.wait_for(state="visible", timeout=5000)
            
            # If it appears, type the bot's name
            name_input.fill("CogniMeet Bot")
            print("✅ Filled in anonymous name!")
            time.sleep(1) # Give the UI a second to unlock the join button
        except Exception:
            print("No name input required. Proceeding...")

        try:
            join_button = page.locator('button:has-text("Ask to join"), button:has-text("Join now")').first
            join_button.wait_for(state="visible", timeout=15000)
            join_button.click()
            print("🚪 Knocked on the door! (PLEASE ADMIT THE BOT FROM YOUR HOST ACCOUNT)")
        except Exception as e:
            print(f"Could not find the Join button. Error: {e}")

        print("⏳ Waiting to be admitted... (Timeout in 60 seconds)")
        try:
            hangup_button = page.locator('button[aria-label*="Leave call" i]')
            hangup_button.wait_for(state="visible", timeout=60000)
            print("✅ Successfully entered the meeting room!")
        except Exception:
            print("❌ Bot was not admitted in time. Leaving.")
            try: context.close() 
            except: pass
            return {"error": "Not admitted"}
        
        time.sleep(3)
        
        # --- ROBUST CAPTIONS FIX ---
        # --- ROBUST CAPTIONS FIX ---
        print("Checking caption status...")
        try:
            # 1. Wiggle the mouse to the center of the 720p screen
            page.mouse.move(100, 100)
            time.sleep(0.5)
            page.mouse.move(640, 360) # 👈 New center coordinates
            time.sleep(1)

            # 2. Find ANY button with "caption" in the label (fuzzy match)
            caption_button = page.locator('button[aria-label*="caption" i]').first
            caption_button.wait_for(state="visible", timeout=3000)

            # 3. Read the actual label to see if they are already on
            label = caption_button.get_attribute("aria-label").lower()
            
            if "turn off" in label:
                print("✅ Captions were already enabled!")
            elif "turn on" in label:
                caption_button.click()
                print("✅ Clicked CC button via UI!")
        except Exception as e:
            print(f"UI Button failed, forcing shortcut: {e}")
            page.mouse.click(640, 360) # 👈 New center coordinates
            time.sleep(0.5)
            page.keyboard.press("c")
            print("✅ Used shortcut 'c' fallback!")
        

        time.sleep(2)

        print("\n=== 🎙️ LISTENING TO MEETING ===")
        print("Bot will leave if you end the call, or after 10 minutes maximum.")
        
        last_text = ""
        NOISE_WORDS = ["language", "English", "format_size", "Font size", "circle", "Font color", "settings", "Open caption settings"]
        
        # --- SMART LIFESPAN FIX ---
        start_time = time.time()
        max_duration = 10 * 60  # 10 minutes in seconds
        
        with open("transcript.txt", "w", encoding="utf-8") as f:
            while True:
                # 1. Check if 10 minutes have passed
                elapsed_time = time.time() - start_time
                if elapsed_time > max_duration:
                    print("\n⏱️ 10-minute maximum reached. Bot is packing up.")
                    break
                
                # 2. Check if the meeting ended (host kicked bot or ended call for all)
                try:
                    if not hangup_button.is_visible():
                        print("\n🚪 Meeting ended or bot was removed. Packing up early!")
                        break
                except Exception:
                    # If checking the button throws an error, the browser tab closed.
                    print("\n🚪 Browser tab closed unexpectedly. Packing up early!")
                    break

                # 3. Scrape Text
                try:
                    captions_elements = page.locator('.CNusmb, .iTTPOb, .a4cQT').all_inner_texts()
                    if captions_elements:
                        clean_captions = [text.strip() for text in captions_elements if text.strip() not in NOISE_WORDS and text.strip() != ""]
                        current_text = " ".join(clean_captions).strip()
                        
                        if current_text and current_text != last_text:
                            print(f"Bot heard: {current_text}")
                            f.write(current_text + " ")
                            f.flush() 
                            last_text = current_text
                except Exception:
                    pass
                
                time.sleep(1.5)

        print("--- Closing Browser ---")
        try:
            context.close()
        except Exception:
            print("Browser was already closed. Moving on!")

    # ==========================================
    # 🧠 PHASE 3: AI SUMMARIZATION & CLOUD STORAGE
    # ==========================================
    print("\n=== 🧠 SENDING DATA TO GEMINI FOR SUMMARIZATION ===")
    
    try:
        with open("transcript.txt", "r", encoding="utf-8") as f:
            transcript_content = f.read()

        if len(transcript_content.strip()) < 10:
            print("Transcript too short. Nobody talked!")
            return {"error": "Transcript empty"}

        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        if not available_models:
             return {"error": "No valid models found for this API key."}
             
        target_model = next((m for m in available_models if 'flash' in m), available_models[0])
        model = genai.GenerativeModel(target_model)

        prompt = f"""
        You are an elite executive assistant. Read the following meeting transcript and generate a highly structured, professional summary. 
        Format your response with the following headers:
        
        ## 📝 Meeting Overview
        (A 2-3 sentence summary of what the meeting was generally about)
        
        ## 🔑 Key Discussion Points
        (Bullet points of the main topics discussed)
        
        ## 🚀 Action Items
        (A numbered list of tasks that need to be done, and who should do them if mentioned)

        Here is the raw transcript:
        "{transcript_content}"
        """

        response = model.generate_content(prompt)
        ai_summary = response.text
        
        print("✅ Summary successfully generated!")

        with open("summary.txt", "w", encoding="utf-8") as f:
            f.write(ai_summary)
            
        # --- AWS S3 UPLOAD ---
        print("☁️ Uploading summary to AWS S3...")
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                region_name=os.environ.get("AWS_REGION", "eu-north-1")
            )
            
            unique_id = str(uuid.uuid4())[:8]
            s3_file_name = f"summary_{unique_id}.txt"
            bucket_name = os.environ.get("AWS_BUCKET_NAME")
            
            s3_client.upload_file("summary.txt", bucket_name, s3_file_name)
            print(f"🏆 SUCCESS! File uploaded to S3 bucket '{bucket_name}' as '{s3_file_name}'")
            
            return {"status": "Success", "summary": ai_summary}
            
        except Exception as s3_error:
            print(f"❌ AWS Upload failed: {s3_error}")
            return {"status": "Success (Local Only)", "summary": ai_summary, "error": "S3 Upload failed"}

    except Exception as e:
        print(f"❌ Failed to generate AI summary: {e}")
        return {"error": str(e)}