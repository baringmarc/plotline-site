import { useState } from 'react'
import { Slider } from '../../components/Slider'
import type { PublicReview } from './api'
import { useApprovedReviews } from './hooks'
import { ReviewForm } from './ReviewForm'

export function ReviewsSection() {
  const reviews = useApprovedReviews()
  const [writing, setWriting] = useState(false)

  return (
    <section className="white" id="reviews">
      <div className="in">
        <h2 className="title">What players and owners say</h2>
        <p className="sub">Real reviews from people who book and run courts with us.</p>

        {reviews.isPending ? (
          <div className="grid3" aria-label="Loading reviews">
            <div className="card skeleton" />
            <div className="card skeleton" />
            <div className="card skeleton" />
          </div>
        ) : reviews.isError ? (
          <p className="center hint">Reviews could not load right now.</p>
        ) : reviews.data.length === 0 ? (
          <p className="center hint">No reviews yet. Be the first to write one.</p>
        ) : (
          <Slider label="Reviews">
            {reviews.data.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </Slider>
        )}

        {writing ? (
          <ReviewForm />
        ) : (
          <p className="center" style={{ marginTop: 20 }}>
            <button type="button" className="btn dark" onClick={() => setWriting(true)}>
              Write a review
            </button>
          </p>
        )}
      </div>
    </section>
  )
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <figure className="card review" style={{ margin: 0 }}>
      <span className="stars" aria-label={`${review.rating} out of 5 stars`}>
        {'★'.repeat(review.rating)}
        {'☆'.repeat(5 - review.rating)}
      </span>
      <p>“{review.quote}”</p>
      <footer>
        <b>{review.name}</b> · {review.role === 'owner' ? 'Venue owner' : 'Player'}
        {review.venue && <>, {review.venue}</>}
      </footer>
    </figure>
  )
}
